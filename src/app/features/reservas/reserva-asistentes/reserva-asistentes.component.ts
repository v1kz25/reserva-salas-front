import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  OnInit,
  computed,
  inject,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { Observable, finalize } from 'rxjs';

import { aProblemDetail } from '../../../core/http/problem-detail';
import { Amigo } from '../../../core/models/amistad.model';
import { EstadoInvitacion, Invitacion } from '../../../core/models/invitacion.model';
import { Reserva } from '../../../core/models/reserva.model';
import { AmistadesService } from '../../../core/services/amistades.service';
import { ConfiguracionService } from '../../../core/services/configuracion.service';
import { InvitacionesService } from '../../../core/services/invitaciones.service';
import { SesionService } from '../../../core/services/sesion.service';
import { AHORA } from '../../../core/tokens/ahora.token';
import { DialogoConfirmacionComponent } from '../../../shared/components/dialogo-confirmacion/dialogo-confirmacion.component';
import {
  AVISO_DEJAR_DE_ASISTIR,
  AVISO_INVITACION_ACEPTADA,
  AVISO_INVITACION_RECHAZADA,
  ESTADO_INVITACION,
  MENSAJE_ELIGE_AMIGO,
  MENSAJE_INVITACION_A_TI_MISMO,
  MENSAJE_INVITACION_NO_EXISTE,
  MENSAJE_INVITAR_SIN_PERMISO,
  avisoInvitacionEnviada,
  avisoInvitacionRetirada,
  mensajeInvitacionRechazadaPorServidor,
  mensajeRespuestaNoPosible,
} from '../../invitaciones/invitaciones-mensajes';
import { fechaIsoEnZona, horaEnZona } from '../../../shared/utils/fecha';

/**
 * Resultado de una acción sobre los asistentes, que muestra y gestiona la pantalla de detalle
 * (los mensajes tienen que sobrevivir a la recarga: tras rechazar, la reserva puede pasar a
 * verse como «Ocupada» y esta sección desaparece).
 */
export interface ResultadoAsistentes {
  /** Mensaje de éxito, si lo hay. */
  aviso?: string;
  /** Mensaje de error, si lo hay. */
  error?: string;
  /** Si hay que recargar la reserva. */
  recargar: boolean;
}

/** Grupo de invitaciones con el mismo estado. */
interface GrupoInvitaciones {
  /** Estado de las invitaciones del grupo. */
  estado: EstadoInvitacion;
  /** Título visible del grupo. */
  titulo: string;
  /** Texto si el grupo está vacío. */
  vacio: string;
  /** Invitaciones del grupo. */
  invitaciones: Invitacion[];
}

/**
 * ReservaAsistentesComponent — sección «Asistentes» del detalle de una reserva vista con
 * `detalle: COMPLETO`: plazas ocupadas sobre la capacidad de la sala e invitaciones agrupadas
 * por estado.
 *
 * - El organizador puede invitar a sus amigos (los que no tienen ya una invitación pendiente o
 *   aceptada) y retirar invitaciones, tras confirmarlo en un diálogo.
 * - Un invitado ve su estado y puede aceptar o rechazar (o «Dejar de asistir» si ya aceptó).
 * - Un `ADMIN` que no organiza solo ve la información.
 *
 * Tras cada acción emite `resultado` y la pantalla recarga la reserva. Mientras hay una acción
 * en curso (o la pantalla está cancelando la reserva) se ignoran las demás.
 */
@Component({
  selector: 'app-reserva-asistentes',
  imports: [ReactiveFormsModule, RouterLink, DialogoConfirmacionComponent],
  templateUrl: './reserva-asistentes.component.html',
  styleUrl: './reserva-asistentes.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReservaAsistentesComponent implements OnInit {
  /** Selector de amigos, que recibe el foco si se intenta invitar sin elegir a nadie. */
  private readonly selectorAmigo = viewChild<ElementRef<HTMLSelectElement>>('selectorAmigo');

  /** Reserva con `detalle: COMPLETO` (con sus invitaciones). */
  readonly reserva = input.required<Reserva>();

  /** Capacidad de la sala, si se conoce. */
  readonly capacidad = input<number>();

  /** Nombre de la sala, para los textos. */
  readonly nombreSala = input('');

  /** Si es `true`, la pantalla tiene otra acción en curso y se ignoran las de esta sección. */
  readonly bloqueado = input(false);

  /** Emite el resultado de cada acción. */
  readonly resultado = output<ResultadoAsistentes>();

  /** Amigos del organizador, una vez cargados. */
  protected readonly amigos = signal<Amigo[] | undefined>(undefined);

  /** Mensaje de error al cargar los amigos, si lo hay. */
  protected readonly errorAmigos = signal<string | undefined>(undefined);

  /** Mensaje de error del selector (invitar sin elegir a nadie), si lo hay. */
  protected readonly errorSeleccion = signal<string | undefined>(undefined);

  /** Clave de la acción en curso (p. ej. `invitar` o `aceptar-5`), si la hay. */
  protected readonly accionEnCurso = signal<string | undefined>(undefined);

  /** Invitación pendiente de confirmar su retirada (diálogo abierto), si la hay. */
  protected readonly invitacionARetirar = signal<Invitacion | undefined>(undefined);

  /** Indica si está abierto el diálogo para confirmar «Dejar de asistir». */
  protected readonly dialogoDejarAbierto = signal(false);

  private readonly sesion = inject(SesionService);
  private readonly amistades = inject(AmistadesService);
  private readonly invitacionesService = inject(InvitacionesService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly configuracion = inject(ConfiguracionService);
  private readonly ahora = inject(AHORA);

  /** Amigo elegido para invitar (`null` si no se ha elegido ninguno). */
  protected readonly amigoElegido = new FormControl<number | null>(null);

  /** Valor del amigo elegido como signal. */
  private readonly amigoElegidoValor = toSignal(this.amigoElegido.valueChanges, { initialValue: null });

  /** Indica si hay alguna acción en curso en esta sección. */
  readonly ocupado = computed(() => this.accionEnCurso() !== undefined);

  /** Indica si se ignoran las acciones (hay una en curso aquí o en la pantalla). */
  protected readonly inactivo = computed(() => this.ocupado() || this.bloqueado());

  /** Invitaciones de la reserva. */
  protected readonly invitaciones = computed(() => this.reserva().invitaciones ?? []);

  /** Indica si el usuario en sesión organiza la reserva. */
  protected readonly esOrganizador = computed(() => this.sesion.esUsuario(this.reserva().usuarioId));

  /** Invitación del usuario en sesión, si está invitado. */
  protected readonly miInvitacion = computed(() => this.reserva().miInvitacion);

  /**
   * Indica si la reserva ya ha terminado (su fin es anterior o igual al momento actual en la
   * zona horaria de la aplicación o, si aún no se conoce, en la del navegador). Se calcula al
   * pintar: no se actualiza solo mientras la pantalla sigue abierta.
   */
  protected readonly pasada = computed(() => {
    const reserva = this.reserva();
    const zona = this.configuracion.zonaHoraria();
    const ahora = this.ahora();
    const hoy = fechaIsoEnZona(ahora, zona);
    return reserva.fecha < hoy || (reserva.fecha === hoy && reserva.horaFin.slice(0, 5) <= horaEnZona(ahora, zona));
  });

  /** Plazas ocupadas: el organizador más las invitaciones pendientes y aceptadas. */
  protected readonly plazasOcupadas = computed(
    () => 1 + this.invitaciones().filter((invitacion) => invitacion.estado !== 'RECHAZADA').length,
  );

  /** Indica si la sala está completa (solo si se conoce su capacidad). */
  protected readonly completa = computed(() => {
    const capacidad = this.capacidad();
    return capacidad !== undefined && this.plazasOcupadas() >= capacidad;
  });

  /** Invitaciones agrupadas por estado, en el orden en que se muestran. */
  protected readonly grupos = computed<GrupoInvitaciones[]>(() => {
    const deEstado = (estado: EstadoInvitacion) => this.invitaciones().filter((i) => i.estado === estado);
    return [
      { estado: 'ACEPTADA', titulo: 'Aceptadas', vacio: 'Nadie ha aceptado todavía.', invitaciones: deEstado('ACEPTADA') },
      { estado: 'PENDIENTE', titulo: 'Pendientes', vacio: 'No hay invitaciones pendientes.', invitaciones: deEstado('PENDIENTE') },
      { estado: 'RECHAZADA', titulo: 'Rechazadas', vacio: 'Nadie ha rechazado la invitación.', invitaciones: deEstado('RECHAZADA') },
    ];
  });

  /** Amigos a los que se puede invitar: sin invitación pendiente ni aceptada en esta reserva. */
  protected readonly amigosDisponibles = computed(() => {
    const invitados = new Set(
      this.invitaciones()
        .filter((invitacion) => invitacion.estado !== 'RECHAZADA')
        .map((invitacion) => invitacion.usuarioId),
    );
    return (this.amigos() ?? []).filter((amigo) => !invitados.has(amigo.usuarioId));
  });

  /**
   * Nombre del amigo elegido en el selector, si sigue disponible (tras recargar la reserva
   * puede tener ya una invitación y haber desaparecido del selector).
   */
  protected readonly nombreElegido = computed(
    () => this.amigosDisponibles().find((amigo) => amigo.usuarioId === this.amigoElegidoValor())?.nombre,
  );

  /** Texto visible de cada estado, para la plantilla. */
  protected readonly estadoInvitacion = ESTADO_INVITACION;

  ngOnInit(): void {
    if (this.esOrganizador()) {
      this.cargarAmigos();
    }
  }

  /**
   * Indica si una acción concreta está en curso, para marcar su botón.
   *
   * @param clave Clave de la acción (p. ej. `aceptar-5`).
   */
  enCurso(clave: string): boolean {
    return this.accionEnCurso() === clave;
  }

  /**
   * Invita al amigo elegido. Sin elegir a nadie, lo indica junto al selector. Si el servidor no
   * lo permite (`400`, `403` o `409`), lo explica; con `409` recarga la reserva y los amigos.
   */
  invitar(): void {
    if (this.inactivo()) {
      return;
    }
    const usuarioId = this.amigoElegido.value;
    const nombre = this.nombreElegido();
    if (usuarioId === null || nombre === undefined) {
      this.amigoElegido.reset(null);
      this.errorSeleccion.set(MENSAJE_ELIGE_AMIGO);
      this.selectorAmigo()?.nativeElement.focus();
      return;
    }
    this.errorSeleccion.set(undefined);
    this.ejecutar('invitar', this.invitacionesService.invitar(this.reserva().id, usuarioId), {
      aviso: avisoInvitacionEnviada(nombre),
      alAcertar: () => this.amigoElegido.reset(null),
      errores: {
        400: { mensaje: (detalle) => detalle ?? MENSAJE_INVITACION_A_TI_MISMO, recargar: false },
        403: { mensaje: MENSAJE_INVITAR_SIN_PERMISO, recargar: false },
        409: { mensaje: (detalle) => mensajeInvitacionRechazadaPorServidor(nombre, detalle), recargar: true },
      },
      alFallarConRecarga: () => this.cargarAmigos(),
    });
  }

  /**
   * Abre el diálogo de confirmación para retirar una invitación.
   *
   * @param invitacion Invitación que se quiere retirar.
   */
  pedirRetirada(invitacion: Invitacion): void {
    if (!this.inactivo()) {
      this.invitacionARetirar.set(invitacion);
    }
  }

  /**
   * Cierra el diálogo de confirmación sin retirar la invitación.
   */
  cerrarDialogo(): void {
    this.invitacionARetirar.set(undefined);
  }

  /**
   * Retira la invitación confirmada en el diálogo. Si ya no existía (`404`), lo indica.
   */
  confirmarRetirada(): void {
    const invitacion = this.invitacionARetirar();
    if (!invitacion || this.inactivo()) {
      return;
    }
    this.ejecutar(`retirar-${invitacion.id}`, this.invitacionesService.retirar(this.reserva().id, invitacion.id), {
      aviso: avisoInvitacionRetirada(invitacion.nombre),
      alTerminar: () => this.cerrarDialogo(),
      errores: {
        403: { mensaje: MENSAJE_INVITAR_SIN_PERMISO, recargar: false },
        404: { mensaje: MENSAJE_INVITACION_NO_EXISTE, recargar: true },
      },
    });
  }

  /**
   * Acepta la invitación del usuario en sesión.
   */
  aceptar(): void {
    const invitacion = this.miInvitacion();
    if (invitacion && !this.inactivo()) {
      this.responder(`aceptar-${invitacion.id}`, this.invitacionesService.aceptar(invitacion.id), AVISO_INVITACION_ACEPTADA);
    }
  }

  /**
   * Rechaza la invitación pendiente del usuario en sesión. Si ya la había aceptado, pide antes
   * confirmación para dejar de asistir.
   */
  pedirRechazo(): void {
    const invitacion = this.miInvitacion();
    if (!invitacion || this.inactivo()) {
      return;
    }
    if (invitacion.estado === 'ACEPTADA') {
      this.dialogoDejarAbierto.set(true);
    } else {
      this.rechazar();
    }
  }

  /**
   * Cierra el diálogo de «Dejar de asistir» sin hacer nada.
   */
  cerrarDialogoDejar(): void {
    this.dialogoDejarAbierto.set(false);
  }

  /**
   * Rechaza la invitación del usuario en sesión o, si ya la había aceptado, deja de asistir
   * (confirmado en el diálogo).
   */
  rechazar(): void {
    const invitacion = this.miInvitacion();
    if (invitacion && !this.inactivo()) {
      const aviso = invitacion.estado === 'ACEPTADA' ? AVISO_DEJAR_DE_ASISTIR : AVISO_INVITACION_RECHAZADA;
      this.responder(`rechazar-${invitacion.id}`, this.invitacionesService.rechazar(invitacion.id), aviso, () =>
        this.cerrarDialogoDejar(),
      );
    }
  }

  private responder(clave: string, peticion: Observable<void>, aviso: string, alTerminar?: () => void): void {
    this.ejecutar(clave, peticion, {
      aviso,
      alTerminar,
      errores: {
        404: { mensaje: MENSAJE_INVITACION_NO_EXISTE, recargar: true },
        409: { mensaje: mensajeRespuestaNoPosible, recargar: true },
      },
    });
  }

  /** Carga los amigos del organizador para el selector. */
  private cargarAmigos(): void {
    this.errorAmigos.set(undefined);
    this.amistades
      .listarAmigos()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (amigos) => this.amigos.set(amigos),
        error: (err: unknown) => {
          const problema = aProblemDetail(err);
          this.errorAmigos.set(problema.detail ?? problema.title);
        },
      });
  }

  /**
   * Ejecuta una acción y emite su resultado. Los errores que no se esperan (ni `404` de la
   * reserva) se muestran con el detalle del servidor y recargan la reserva por si ha cambiado.
   */
  private ejecutar<T>(
    clave: string,
    peticion: Observable<T>,
    opciones: {
      aviso: string;
      errores: Partial<Record<number, { mensaje: string | ((detalle?: string) => string); recargar: boolean }>>;
      alAcertar?: () => void;
      alTerminar?: () => void;
      alFallarConRecarga?: () => void;
    },
  ): void {
    this.accionEnCurso.set(clave);
    peticion
      .pipe(
        finalize(() => this.accionEnCurso.set(undefined)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          opciones.alTerminar?.();
          opciones.alAcertar?.();
          this.resultado.emit({ aviso: opciones.aviso, recargar: true });
        },
        error: (err: unknown) => {
          opciones.alTerminar?.();
          const problema = aProblemDetail(err);
          const esperado = opciones.errores[problema.status];
          if (esperado) {
            const mensaje = typeof esperado.mensaje === 'string' ? esperado.mensaje : esperado.mensaje(problema.detail);
            if (esperado.recargar) {
              opciones.alFallarConRecarga?.();
            }
            this.resultado.emit({ error: mensaje, recargar: esperado.recargar });
          } else {
            // Incluye el `404` de la reserva (cancelada mientras tanto): al recargar se indica.
            this.resultado.emit({ error: problema.detail ?? problema.title, recargar: true });
          }
        },
      });
  }
}
