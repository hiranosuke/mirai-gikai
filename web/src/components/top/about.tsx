import Image from "next/image";

export function About() {
  return (
    <div className="py-10">
      <div className="flex flex-col gap-4">
        {/* ヘッダー */}
        <div className="flex flex-col gap-4">
          <h2>
            <Image
              src="/icons/about-typography.svg"
              alt="About"
              width={143}
              height={36}
              priority
            />
          </h2>
          <p className="text-sm font-bold text-primary-accent">
            みらい議会＠さいたま市とは
          </p>
        </div>

        {/* コンテンツ */}
        <div className="flex flex-col gap-3">
          <h3 className="text-2xl font-bold leading-[43.2px]">
            さいたま市議会での議論を
            <br />
            できる限りわかりやすく
          </h3>
          <p className="text-[15px] leading-[28px] text-black">
            みらい議会＠さいたま市は、さいたま市議会で今どんな議案が審議されているか、わかりやすく伝えるプラットフォームです。市民の意見を市政に届けることを目指して、継続的にアップデートしていきます。
          </p>
        </div>
      </div>
    </div>
  );
}
