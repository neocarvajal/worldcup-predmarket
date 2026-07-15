export function bgImage(name: string): React.CSSProperties {
  const webp = `/images/${name}.webp`;
  const jpg = `/images/${name}.jpg`;
  return {
    backgroundImage: `image-set(url(${webp}) type("image/webp"), url(${jpg}) type("image/jpeg"))`,
  };
}
