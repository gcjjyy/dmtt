import { useState } from "react";
import { useNavigate } from "react-router";
import { useLanguage } from "~/contexts/LanguageContext";
import { DosWindow } from "~/components/DosWindow";

export function meta() {
  return [
    { title: "환영합니다 | 도·박타자교사" },
  ];
}

export default function Welcome() {
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");

  // 이름 길이 계산 (한글 = 2, 영문/숫자/공백 = 1)
  const calculateNameLength = (name: string): number => {
    let length = 0;
    for (const char of name) {
      // 한글 유니코드 범위: AC00-D7A3
      if (char >= '\uAC00' && char <= '\uD7A3') {
        length += 2;
      } else {
        length += 1;
      }
    }
    return length;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const trimmedName = username.trim();

    // Validation
    if (trimmedName.length === 0) {
      setError(t("이름을 입력해주세요", "Please enter your name"));
      return;
    }

    // Check for valid characters (Korean, English, numbers, spaces, dots, hyphens)
    const validNamePattern = /^[가-힣a-zA-Z0-9\s.\-]+$/;
    if (!validNamePattern.test(trimmedName)) {
      setError(t("한글, 영문, 숫자, 공백, 점, 하이픈만 사용 가능합니다", "Only Korean, English, numbers, spaces, dots, and hyphens allowed"));
      return;
    }

    // 길이 체크 (한글=2, 영문/숫자/공백=1, 최대 16)
    const nameLength = calculateNameLength(trimmedName);
    if (nameLength > 16) {
      setError(t("이름이 너무 깁니다 (한글 최대 8자, 영문 최대 16자)", "Name is too long (Korean: 8 chars max, English: 16 chars max)"));
      return;
    }

    // Save to localStorage
    localStorage.setItem("typing-practice-username", trimmedName);

    // Navigate to home
    navigate("/");
  };

  return (
    <div className="w-full h-full bg-[#008080] flex items-center justify-center p-4">
      <DosWindow title={t("환영합니다!", "Welcome!")} className="w-full max-w-[500px]">
        <div className="p-6">
          {/* Welcome Message */}
          <div className="mb-6 text-center">
            <div className="text-4xl mb-4">👋</div>
            <p className="text-black mb-2">
              {t(
                "타자 연습을 시작하기 전에 이름을 입력해주세요",
                "Please enter your name before starting"
              )}
            </p>
            <p className="text-[#808080] text-sm">
              {t(
                "입력한 이름은 점수 기록에 사용됩니다",
                "Your name will be used for score tracking"
              )}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label
                htmlFor="username"
                className="block text-black mb-2"
              >
                {t("이름", "Name")}
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setError("");
                }}
                className="w-full h-[22px] px-2 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white text-black focus:outline-none"
                placeholder={t("홍길동", "Your Name")}
                autoFocus
              />
              {error && (
                <p className="mt-2 text-red-600">
                  {error}
                </p>
              )}
            </div>

            <button
              type="submit"
              className="w-full h-[26px] flex items-center justify-center text-black bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black hover:bg-[#D0D0D0]"
            >
              {t("시작하기", "Start")}
            </button>
          </form>
        </div>
      </DosWindow>
    </div>
  );
}
