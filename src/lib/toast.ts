type Listener = (message: string) => void;

let listener: Listener | null = null;

export function setToastListener(l: Listener | null) {
  listener = l;
}

export function toast(message: string) {
  listener?.(message);
}
