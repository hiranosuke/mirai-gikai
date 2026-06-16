import { ExternalLink } from "lucide-react";
import type { Metadata } from "next";
import { Container } from "@/components/layouts/container";
import {
  LegalList,
  LegalPageLayout,
  LegalParagraph,
  LegalSectionTitle,
} from "@/components/layouts/legal-page-layout";
import { EXTERNAL_LINKS } from "@/config/external-links";

export const metadata: Metadata = {
  title: "このサイトについて | みらい議会＠さいたま市",
  description:
    "みらい議会＠さいたま市の目的と、本家「みらい議会」・チームみらいとの関係についてご説明します。",
};

function ExternalAnchor({ href, label }: { href: string; label: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex items-center gap-1 text-primary-accent underline-offset-2 hover:underline"
    >
      {label}
      <ExternalLink className="size-3.5" aria-hidden />
    </a>
  );
}

const relatedLinks = [
  {
    id: "team-mirai-note",
    label: "チームみらい公式note",
    href: EXTERNAL_LINKS.TEAM_MIRAI_NOTE,
  },
  {
    id: "team-mirai-official",
    label: "チームみらい公式サイト",
    href: EXTERNAL_LINKS.TEAM_MIRAI_OFFICIAL,
  },
  {
    id: "mirai-gikai-honke",
    label: "本家「みらい議会」",
    href: EXTERNAL_LINKS.MIRAI_GIKAI_HONKE,
  },
];

export default function AboutPage() {
  return (
    <LegalPageLayout
      title="このサイトについて"
      description="みらい議会＠さいたま市の目的と、本家「みらい議会」・チームみらいとの関係についてご説明します。"
      className="pt-24 md:pt-12"
    >
      <Container className="space-y-10">
        <section className="space-y-4">
          <LegalSectionTitle>このサイトの目的</LegalSectionTitle>
          <LegalParagraph>
            みらい議会＠さいたま市は、さいたま市議会でいま何が議論されているかを、できる限りわかりやすく伝えることを目的とした非公式のサイトです。さいたま市政に関心を持つ有志が、公開されている情報をもとに作成・運営しています。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>
            「みらい議会」とチームみらいについて
          </LegalSectionTitle>
          <LegalParagraph>
            「みらい議会」は、政党チームみらいが開発・運営している、国会での議論を市民にわかりやすく届けるためのプロジェクトです。本サイトはその仕組みを、さいたま市議会向けに活用したものです。
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>このサイトとチームみらいの関係</LegalSectionTitle>
          <LegalParagraph>
            本サイトは、チームみらいがオープンソース（AGPL-3.0）として公開している「みらい議会」のソースコードをフォークし、さいたま市向けに改変して運営しています。有益なプロダクトをオープンソースとして公開してくれたチームみらいに、敬意と感謝を表します。
          </LegalParagraph>
          <LegalParagraph>
            一方で、本サイトはチームみらいを応援・宣伝することを目的に立ち上げたものではありません。さいたま市議会の議論を可視化し、市民のみなさんが市政により関心を持てるようにすることを、独立した立場で目指すものです。運営の主体・方針はチームみらいとは独立しており、
            <span className="font-semibold text-slate-800">
              これは政党チームみらいが運営しているものではありません。
            </span>
          </LegalParagraph>
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>関連リンク</LegalSectionTitle>
          <LegalList
            items={relatedLinks.map((link) => ({
              id: link.id,
              content: <ExternalAnchor href={link.href} label={link.label} />,
            }))}
          />
        </section>

        <section className="space-y-4">
          <LegalSectionTitle>運営について</LegalSectionTitle>
          <LegalParagraph>
            本サイトは、さいたま市政に関心を持つ一個人（有志）が運営しています。本サイトのソースコードは、本家「みらい議会」と同じくオープンソース（AGPL-3.0）として公開しています。
          </LegalParagraph>
          <LegalList
            items={[
              {
                id: "source-code",
                content: (
                  <ExternalAnchor
                    href={EXTERNAL_LINKS.SOURCE_CODE}
                    label="ソースコード（GitHub）"
                  />
                ),
              },
            ]}
          />
        </section>
      </Container>
    </LegalPageLayout>
  );
}
