import Image from "next/image";

export function BrandLogo() {
  return (
    <Image
      className="brand-logo"
      src="/roomready-logo.png"
      alt="RoomReady"
      width={2172}
      height={724}
    />
  );
}
