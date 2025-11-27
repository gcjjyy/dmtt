import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { useLanguage } from "~/contexts/LanguageContext";
import { getLongTextList } from "~/lib/data-loader.server";
import { DosWindowAlt } from "~/components/DosWindowAlt";

export function meta() {
  return [
    { title: "장문 연습 | 도·박타자교사" },
  ];
}

export async function loader({ request }: Route.LoaderArgs) {
  const url = new URL(request.url);
  const lang = (url.searchParams.get("lang") || "ko") as "ko" | "en";

  const textList = await getLongTextList(lang);

  return { textList, language: lang };
}

export default function LongPracticeIndex() {
  const { textList, language } = useLoaderData<typeof loader>();
  const { t } = useLanguage();

  return (
    <div className="w-full h-full bg-[#008080] flex items-center justify-center p-4">
      <DosWindowAlt title={t("장문 연습", "Long Text Practice")} className="mx-auto max-h-[400px]">
        <div className="flex flex-col overflow-y-auto">
          {textList.map((text, index) => (
            <Link
              key={text.id}
              to={`/long-practice/${text.id}?lang=${language}`}
              className="px-3 text-black hover:bg-black hover:text-white cursor-pointer"
            >
              {index + 1}. {text.title}
            </Link>
          ))}
        </div>
      </DosWindowAlt>
    </div>
  );
}
