import Image from "next/image";

export function Logo() {
  return <Image className="logo" src="/page-logo.svg" alt="PAGE" width={132} height={44} priority />;
}
