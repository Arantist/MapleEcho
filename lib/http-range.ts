export type ByteRange = {
  start: number;
  end: number;
  contentLength: number;
};

export function parseByteRange(header: string | null, fileSize: number): ByteRange | null {
  if (!header || fileSize <= 0) return null;

  const match = header.match(/^bytes=(\d*)-(\d*)$/);
  if (!match) return null;

  const [, rawStart, rawEnd] = match;
  if (!rawStart && !rawEnd) return null;

  if (!rawStart) {
    const suffixLength = Number(rawEnd);
    if (!Number.isInteger(suffixLength) || suffixLength <= 0) return null;
    const contentLength = Math.min(suffixLength, fileSize);
    const start = fileSize - contentLength;
    const end = fileSize - 1;
    return { start, end, contentLength };
  }

  const start = Number(rawStart);
  const requestedEnd = rawEnd ? Number(rawEnd) : fileSize - 1;
  if (!Number.isInteger(start) || !Number.isInteger(requestedEnd)) return null;
  if (start < 0 || start >= fileSize || requestedEnd < start) return null;

  const end = Math.min(requestedEnd, fileSize - 1);
  return { start, end, contentLength: end - start + 1 };
}
