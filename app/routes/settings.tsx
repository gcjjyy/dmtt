import { useState, useEffect } from "react";
import { useLanguage, type Language } from "~/contexts/LanguageContext";
import { DosWindow } from "~/components/DosWindow";

export default function Settings() {
  const { language, setLanguage, t } = useLanguage();

  // Username state
  const [currentUsername, setCurrentUsername] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [usernameError, setUsernameError] = useState("");

  // Load username from localStorage
  useEffect(() => {
    const username = localStorage.getItem("typing-practice-username") || "";
    setCurrentUsername(username);
    setNewUsername(username);
  }, []);

  const handleLanguageChange = (lang: Language) => {
    setLanguage(lang);
  };

  const handleUsernameChange = () => {
    const trimmedName = newUsername.trim();

    // Validation
    if (trimmedName.length === 0) {
      setUsernameError(t("이름을 입력해주세요", "Please enter your name"));
      return;
    }

    if (trimmedName.length > 50) {
      setUsernameError(t("이름은 50자 이내로 입력해주세요", "Name must be 50 characters or less"));
      return;
    }

    const validNamePattern = /^[가-힣a-zA-Z0-9\s]+$/;
    if (!validNamePattern.test(trimmedName)) {
      setUsernameError(t("한글, 영문, 숫자만 사용 가능합니다", "Only Korean, English, and numbers allowed"));
      return;
    }

    // Show confirmation dialog
    setShowConfirmDialog(true);
  };

  const confirmUsernameChange = () => {
    const trimmedName = newUsername.trim();
    localStorage.setItem("typing-practice-username", trimmedName);
    setCurrentUsername(trimmedName);
    setShowConfirmDialog(false);
    setShowSuccess(true);
    setUsernameError("");

    // Hide success message after 3 seconds
    setTimeout(() => setShowSuccess(false), 3000);
  };

  return (
    <div className="w-full h-full bg-[#008080] flex flex-col items-center justify-center p-4 gap-2">
      {/* Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 flex items-center justify-center z-[9999]" style={{ backgroundColor: 'rgba(0, 0, 0, 0.5)' }}>
          <div className="bg-[#C0C0C0] border border-black w-[400px]">
            <div className="border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080]">
              <div className="mx-1 my-1 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0]">
                {/* Title Bar */}
                <div className="bg-[#0000AA] text-white py-1 px-2 flex items-center justify-between">
                  <span>{t("사용자명 변경", "Change Username")}</span>
                </div>
                {/* Content */}
                <div className="p-4 bg-[#C0C0C0]">
                  <p className="text-black mb-6">
                    {t(
                      "사용자명을 변경하시겠습니까?",
                      "Are you sure you want to change your username?"
                    )}
                  </p>
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => setShowConfirmDialog(false)}
                      className="h-[22px] px-4 flex items-center text-black bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black"
                    >
                      {t("취소", "Cancel")}
                    </button>
                    <button
                      onClick={confirmUsernameChange}
                      className="h-[22px] px-4 flex items-center text-black bg-[#C0C0C0] border-2 border-t-white border-l-white border-b-black border-r-black"
                    >
                      {t("확인", "Confirm")}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Settings Window */}
      <DosWindow title={t("설정", "Settings")} className="w-full max-w-[600px]">
        <div className="p-4">
          {/* Username Settings */}
          <div className="mb-6 pb-6 border-b-2 border-[#808080]">
            <h2 className="text-black mb-2">
              {t("사용자명 설정", "Username Settings")}
            </h2>
            <p className="text-black mb-4">
              {t(
                "점수 기록에 사용될 이름을 변경할 수 있습니다",
                "Change the name used for score tracking"
              )}
            </p>

            <div className="mb-2">
              <label
                htmlFor="username"
                className="block text-black mb-1"
              >
                {t("현재 사용자명", "Current Username")}
              </label>
              <div className="flex gap-2">
                <input
                  id="username"
                  type="text"
                  value={newUsername}
                  onChange={(e) => {
                    setNewUsername(e.target.value);
                    setUsernameError("");
                    setShowSuccess(false);
                  }}
                  className="flex-1 h-[22px] px-1 border-2 border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-white text-black focus:outline-none"
                  placeholder={t("이름 입력", "Enter name")}
                />
                <button
                  onClick={handleUsernameChange}
                  disabled={newUsername.trim() === currentUsername}
                  className={`h-[22px] px-4 flex items-center border-2 ${
                    newUsername.trim() === currentUsername
                      ? "bg-[#808080] text-[#C0C0C0] cursor-not-allowed border-t-[#A0A0A0] border-l-[#A0A0A0] border-b-[#606060] border-r-[#606060]"
                      : "bg-[#C0C0C0] text-black border-t-white border-l-white border-b-black border-r-black"
                  }`}
                >
                  {t("변경", "Change")}
                </button>
              </div>
              {usernameError && (
                <p className="mt-1 text-red-600">
                  {usernameError}
                </p>
              )}
              {showSuccess && (
                <p className="mt-1 text-[#0000AA]">
                  {t("사용자명이 변경되었습니다", "Username has been changed")}
                </p>
              )}
            </div>
          </div>

          {/* Language Settings */}
          <div>
            <h2 className="text-black mb-2">
              {t("언어 설정", "Language Settings")}
            </h2>
            <p className="text-black mb-4">
              {t(
                "타자 연습에 사용할 언어를 선택하세요",
                "Choose the language for typing practice"
              )}
            </p>

            <div className="bg-[#C0C0C0] border border-black">
              <div className="border-2 border-t-white border-l-white border-b-[#808080] border-r-[#808080]">
                <div className="mx-1 my-1 border border-t-[#808080] border-l-[#808080] border-b-white border-r-white bg-[#C0C0C0]">
                  <div className="flex">
                    <button
                      onClick={() => handleLanguageChange("ko")}
                      className={`flex-1 basis-0 h-5 flex items-center justify-center border-r border-black whitespace-nowrap ${
                        language === "ko"
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      {t("한국어", "한국어")}
                    </button>
                    <button
                      onClick={() => handleLanguageChange("en")}
                      className={`flex-1 basis-0 h-5 flex items-center justify-center whitespace-nowrap ${
                        language === "en"
                          ? "bg-black text-white"
                          : "bg-white text-black"
                      }`}
                    >
                      English
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DosWindow>
    </div>
  );
}
