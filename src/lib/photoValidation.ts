/**
 * Camera RAW formats (DNG, CR2/CR3, NEF, ARW, etc.) aren't supported by our image pipeline —
 * sharp/libvips can't decode raw sensor data without an extra library (libraw) we don't run, and
 * even if it could, these files are 20-100MB+ of unprocessed data never meant for direct web
 * upload. Every phone/camera that shoots RAW also has a "convert to JPEG" export option, so the
 * right move is a clear, specific error pointing that out instead of a generic upload failure
 * (which is what sharp() throwing on an undecodable buffer would otherwise produce).
 */
const RAW_EXTENSIONS = [
  ".dng", // Adobe/most Android + iPhone ProRAW
  ".cr2", ".cr3", // Canon
  ".nef", // Nikon
  ".arw", // Sony
  ".raf", // Fujifilm
  ".orf", // Olympus
  ".rw2", // Panasonic
  ".pef", // Pentax
  ".srw", // Samsung
];

export function rawFormatError(filename: string): string | null {
  const lower = filename.toLowerCase();
  if (RAW_EXTENSIONS.some((ext) => lower.endsWith(ext))) {
    return "RAW/DNG camera files aren't supported. Export or share it as a JPEG or PNG first (most camera apps have a \"convert to JPEG\" option), then upload that instead.";
  }
  return null;
}
