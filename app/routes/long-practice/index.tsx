import { Link, useLoaderData } from "react-router";
import type { Route } from "./+types/index";
import { useLanguage } from "~/contexts/LanguageContext";
import { getLongTextList } from "~/lib/data-loader.server";

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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <h1 className="text-gray-900 dark:text-white">
            {t("장문 연습", "Long Text Practice")}
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {textList.map((text) => (
            <Link
              key={text.id}
              to={`/long-practice/${text.id}?lang=${language}`}
              className="bg-white dark:bg-gray-800 rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-blue-500"
            >
              <div className="flex items-center gap-4">
                <div>📖</div>
                <div>
                  <h2 className="text-gray-900 dark:text-white">
                    {text.title}
                  </h2>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
