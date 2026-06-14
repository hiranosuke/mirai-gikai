import Image from "next/image";
import { Container } from "@/components/layouts/container";

export function Hero() {
  return (
    <div className="relative w-full h-[80vh] min-h-[400px] md:h-[70vh] overflow-hidden bg-gradient-to-b from-mirai-surface to-mirai-gradient-end">
      {/* ワンポイント: さいたま市マスコット「つなが竜ヌゥ」（右下） */}
      <Image
        src="/img/nuu-onepoint.png"
        alt="さいたま市マスコット つなが竜ヌゥ"
        width={560}
        height={583}
        priority
        className="pointer-events-none absolute bottom-0 right-3 h-auto w-32 sm:w-40 md:w-52"
      />
      <div className="absolute bottom-[30vh] left-0 right-0 py-4">
        <Container>
          <p className="font-bold text-xl md:text-2xl leading-relaxed">
            いまさいたま市議会で議論されていること <br />
            やさしい言葉で説明します
          </p>
          <p className="mt-2 font-lexend text-xs">powered by AI</p>
        </Container>
      </div>

      {/* スクロールインジケーター */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center animate-bounce-gentle">
        <div className="w-[1px] h-[34px] bg-black"></div>
        <p className="mt-2 font-lexend text-[10px] leading-[20px] text-black">
          Scroll
        </p>
      </div>
    </div>
  );
}
