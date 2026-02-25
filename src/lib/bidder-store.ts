let storedFile: File | null = null;

export function setBidderZip(file: File | null) {
  storedFile = file;
}

export function getBidderZip(): File | null {
  return storedFile;
}
