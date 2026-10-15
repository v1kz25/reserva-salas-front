/**
 * Indica si el foco se ha perdido: no hay elemento activo, está en `body`, el elemento
 * ya no está en la página o está dentro de un `<dialog>` cerrado (el navegador aún no
 * lo ha movido).
 *
 * @param documento Documento en el que se comprueba el foco.
 */
export function focoPerdido(documento: Document): boolean {
  const activo = documento.activeElement;
  if (!activo || activo === documento.body || !activo.isConnected) {
    return true;
  }
  const dialogo = activo.closest('dialog');
  return dialogo !== null && !dialogo.open;
}
