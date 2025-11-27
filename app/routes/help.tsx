import { useState } from "react";
import { useLanguage } from "~/contexts/LanguageContext";
import { DosWindow } from "~/components/DosWindow";

export function meta() {
  return [
    { title: "도움말 | 도·박타자교사" },
  ];
}

type Topic = "short" | "long" | "venice" | "rankings" | "settings" | "credits";

export default function Help() {
  const { t } = useLanguage();
  const [selectedTopic, setSelectedTopic] = useState<Topic>("short");

  const topics: { id: Topic; title: string; titleEn: string }[] = [
    { id: "short", title: "단문 연습", titleEn: "Short Practice" },
    { id: "long", title: "장문 연습", titleEn: "Long Practice" },
    { id: "venice", title: "베네치아 게임", titleEn: "Venice Game" },
    { id: "rankings", title: "랭킹", titleEn: "Rankings" },
    { id: "settings", title: "환경설정", titleEn: "Settings" },
    { id: "credits", title: "제작자", titleEn: "Credits" },
  ];

  const content: Record<Topic, { ko: string; en: string }> = {
    short: {
      ko: "짧은 속담과 문장으로 타자 연습을 할 수 있습니다. 문장을 정확히 입력하고 엔터를 누르면 자동으로 다음 문장으로 넘어갑니다.",
      en: "Practice typing with short proverbs and sentences. Type accurately and press Enter to move to the next sentence.",
    },
    long: {
      ko: "긴 글을 통해 타자 실력을 향상시킬 수 있습니다. 페이지 단위로 연습할 수 있으며, 전체 완료 시 결과를 확인할 수 있습니다.",
      en: "Improve your typing skills with long texts. Practice page by page and see your results upon completion.",
    },
    venice: {
      ko: "떨어지는 단어를 입력하는 게임입니다. 단어가 바닥에 닿기 전에 정확히 입력해야 합니다. 레벨이 올라갈수록 속도가 빨라집니다.",
      en: "A game where you type falling words. Type them accurately before they reach the bottom. Speed increases with each level.",
    },
    rankings: {
      ko: "각 연습 모드별로 최고 기록을 확인할 수 있습니다. 타수(CPM)와 정확도를 기준으로 순위가 매겨집니다.",
      en: "Check top scores for each practice mode. Rankings are based on CPM (characters per minute) and accuracy.",
    },
    settings: {
      ko: "사용자명을 변경하고 연습 언어(한글/영어)를 선택할 수 있습니다.",
      en: "Change your username and select practice language (Korean/English).",
    },
    credits: {
      ko: "제작자: QuickBASIC\n이메일: gcjjyy@gmail.com\n\n도움주신 분들:\n- 하늘소\n- 피시키드",
      en: "Creator: QuickBASIC\nEmail: gcjjyy@gmail.com\n\nContributors:\n- Hanulso\n- PC Kid",
    },
  };

  return (
    <div className="w-full h-full bg-[#008080] flex flex-col items-center justify-center p-4 gap-2">
      {/* Main Help Window */}
      <DosWindow title={t("도움말", "Help")} className="w-full max-w-[600px]">
        <div className="flex h-[300px]">
          {/* Left Column - Topics (1/3) */}
          <div className="w-1/3 border-r border-black overflow-y-auto bg-white">
            {topics.map((topic, index) => (
              <button
                key={topic.id}
                onClick={() => setSelectedTopic(topic.id)}
                className={`w-full h-[22px] text-left px-3 flex items-center ${
                  selectedTopic === topic.id
                    ? "bg-black text-white"
                    : "bg-white text-black"
                }`}
              >
                {index + 1}. {t(topic.title, topic.titleEn)}
              </button>
            ))}
          </div>

          {/* Right Column - Content (2/3) */}
          <div className="w-2/3 p-4 text-black whitespace-pre-line">
            {t(content[selectedTopic].ko, content[selectedTopic].en)}
          </div>
        </div>
      </DosWindow>
    </div>
  );
}
