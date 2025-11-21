import { Link } from "react-router";
import { useLanguage } from "~/contexts/LanguageContext";

export default function Help() {
  const { t } = useLanguage();

  return (
    <div className="p-8">
      <div className="w-full">
        <div className="flex justify-between items-center mb-8">
          <Link
            to="/"
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
          >
            ← {t("돌아가기", "Back")}
          </Link>
          <h1 className="text-gray-900 dark:text-white">
            {t("도움말", "Help")}
          </h1>
          <div className="w-20"></div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-2xl p-8 shadow-xl">
          <h2 className="text-gray-900 dark:text-white mb-4">
            {t("도박타자교사 사용법", "How to Use DMTT")}
          </h2>

          <div className="space-y-6 text-gray-600 dark:text-gray-400">
            <section>
              <h3 className="text-gray-900 dark:text-white mb-2">
                {t("단문 연습", "Short Practice")}
              </h3>
              <p>
                {t(
                  "짧은 속담과 문장으로 타자 연습을 할 수 있습니다. 문장을 정확히 입력하고 엔터를 누르면 자동으로 다음 문장으로 넘어갑니다.",
                  "Practice typing with short proverbs and sentences. Type accurately and press Enter to move to the next sentence."
                )}
              </p>
            </section>

            <section>
              <h3 className="text-gray-900 dark:text-white mb-2">
                {t("장문 연습", "Long Practice")}
              </h3>
              <p>
                {t(
                  "긴 글을 통해 타자 실력을 향상시킬 수 있습니다. 페이지 단위로 연습할 수 있으며, 전체 완료 시 결과를 확인할 수 있습니다.",
                  "Improve your typing skills with long texts. Practice page by page and see your results upon completion."
                )}
              </p>
            </section>

            <section>
              <h3 className="text-gray-900 dark:text-white mb-2">
                {t("베네치아 게임", "Venice Game")}
              </h3>
              <p>
                {t(
                  "떨어지는 단어를 입력하는 게임입니다. 단어가 바닥에 닿기 전에 정확히 입력해야 합니다. 레벨이 올라갈수록 속도가 빨라집니다.",
                  "A game where you type falling words. Type them accurately before they reach the bottom. Speed increases with each level."
                )}
              </p>
            </section>

            <section>
              <h3 className="text-gray-900 dark:text-white mb-2">
                {t("랭킹", "Rankings")}
              </h3>
              <p>
                {t(
                  "각 연습 모드별로 최고 기록을 확인할 수 있습니다. 타수(CPM)와 정확도를 기준으로 순위가 매겨집니다.",
                  "Check top scores for each practice mode. Rankings are based on CPM (characters per minute) and accuracy."
                )}
              </p>
            </section>

            <section>
              <h3 className="text-gray-900 dark:text-white mb-2">
                {t("환경설정", "Settings")}
              </h3>
              <p>
                {t(
                  "사용자명을 변경하고 연습 언어(한글/영어)를 선택할 수 있습니다.",
                  "Change your username and select practice language (Korean/English)."
                )}
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
