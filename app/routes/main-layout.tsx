import { useState, useEffect, useRef } from "react";
import { Outlet, useNavigate, useLocation } from "react-router";
import { useLanguage } from "~/contexts/LanguageContext";
import { useGameStatus } from "~/contexts/GameStatusContext";

const HomeIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <path d="M12 3L2 12h3v9h6v-6h2v6h6v-9h3L12 3z" />
  </svg>
);

type MenuKey = "home" | "dmtt" | "practice" | "game" | "ranking" | null;

export default function MainLayout() {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const location = useLocation();
  const { statusMessage } = useGameStatus();
  const [openMenu, setOpenMenu] = useState<MenuKey>(null);
  const [username, setUsername] = useState("");
  const [currentTime, setCurrentTime] = useState<Date | null>(null);
  const [isMouseMode, setIsMouseMode] = useState(false); // 마우스 사용 모드 감지
  const menuBarRef = useRef<HTMLDivElement>(null);

  const isHomePage = location.pathname === '/';

  // Load username from localStorage
  useEffect(() => {
    const savedUsername = localStorage.getItem("typing-practice-username") || "";
    setUsername(savedUsername);
  }, []);

  // Update time every second (클라이언트에서만 실행)
  useEffect(() => {
    // 클라이언트에서만 시간 초기화
    setCurrentTime(new Date());

    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatTime = (date: Date | null) => {
    if (!date) return '--:--:--'; // SSR 기본값
    const hours = date.getHours().toString().padStart(2, '0');
    const minutes = date.getMinutes().toString().padStart(2, '0');
    const seconds = date.getSeconds().toString().padStart(2, '0');
    return `${hours}:${minutes}:${seconds}`;
  };

  // Detect mouse mode (마우스 사용 감지)
  useEffect(() => {
    const handleMouseMove = () => {
      if (!isMouseMode) {
        setIsMouseMode(true);
      }
    };

    const handleKeyDown = () => {
      setIsMouseMode(false);
    };

    document.addEventListener("mousemove", handleMouseMove, { once: true });
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isMouseMode]);

  // Close menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(event.target as Node)) {
        setOpenMenu(null);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleMenuClick = (menuKey: MenuKey, directPath?: string) => {
    if (directPath) {
      navigate(directPath);
      setOpenMenu(null);
    } else {
      setOpenMenu(openMenu === menuKey ? null : menuKey);
    }
  };

  const handleMenuHover = (menuKey: MenuKey, hasSubMenu: number) => {
    // 이미 메뉴가 열려있고, 서브메뉴가 있는 메뉴에 hover한 경우에만 전환
    if (openMenu !== null && hasSubMenu > 0) {
      setOpenMenu(menuKey);
    }
  };

  const handleMenuItemClick = (path: string) => {
    navigate(path);
    setOpenMenu(null);
  };

  const menuItems = [
    {
      key: "home" as MenuKey,
      label: <HomeIcon />,
      items: [],
      path: "/",
    },
    {
      key: "practice" as MenuKey,
      label: t("문장연습", "Practice"),
      items: [
        { label: t("단문 연습", "Short Practice"), path: `/short-practice?lang=${language}` },
        { label: t("장문 연습", "Long Practice"), path: `/long-practice?lang=${language}` },
      ],
    },
    {
      key: "game" as MenuKey,
      label: t("게임", "Game"),
      items: [
        { label: t("베네치아", "Venice"), path: `/venice?lang=${language}` },
      ],
    },
    {
      key: "ranking" as MenuKey,
      label: t("랭킹", "Ranking"),
      items: [
        { label: t("단문 랭킹", "Short Ranking"), path: "/rankings/short" },
        { label: t("장문 랭킹", "Long Ranking"), path: "/rankings/long" },
        { label: t("베네치아 랭킹", "Venice Ranking"), path: "/rankings/venice" },
      ],
    },
    {
      key: "dmtt" as MenuKey,
      label: username ? `${username}${t("님", "")}` : t("게스트", "Guest"),
      items: [
        { label: t("환경설정", "Settings"), path: "/settings" },
        { label: t("도움말", "Help"), path: "/help" },
      ],
    },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center m-0 p-0">
      <div className="w-[800px] h-[600px] flex flex-col m-0 outline outline-1 outline-black">
        {/* Title Bar */}
        <div className="bg-[#0000AA] border-t border-l border-b border-t-white border-l-white border-b-black h-6 px-1 text-white flex justify-center items-center">
          도·박 타 자 교 사
        </div>

        {/* Menu Bar */}
        <div
          ref={menuBarRef}
          className="bg-white h-5 flex relative border-b border-black pl-2 z-10"
        >
          {menuItems.map((menu) => (
            <div key={menu.key} className="relative">
              <div
                onClick={() => handleMenuClick(menu.key, menu.items.length === 0 ? menu.path : undefined)}
                onMouseEnter={() => handleMenuHover(menu.key, menu.items.length)}
                className={`px-1 flex items-center cursor-pointer border ${
                  openMenu === menu.key
                    ? "h-[19px] bg-black text-white border-black"
                    : "h-[18px] bg-white text-black border-transparent hover:h-[19px] hover:bg-black hover:text-white"
                }`}
              >
                {menu.label}
              </div>

              {/* Dropdown Submenu */}
              {openMenu === menu.key && (
                <div className="absolute top-[19px] left-0 bg-white border border-black z-1000 min-w-[150px]">
                  {menu.items.map((item, index) => (
                    <div
                      key={index}
                      onClick={() => handleMenuItemClick(item.path)}
                      className="h-[18px] px-1 flex items-center cursor-pointer text-black bg-white hover:bg-black hover:text-white"
                    >
                      {item.label}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Main Content Area */}
        <div className="flex-1 w-full overflow-visible">
          <Outlet />
        </div>

        {/* Status Bar */}
        <div className="h-5 bg-white text-black border-t border-black flex items-center px-2 justify-between">
          <span>{isHomePage ? '(C) 2025 QuickBASIC (gcjjyy@gmail.com)' : statusMessage}</span>
          <span>{formatTime(currentTime)}</span>
        </div>
      </div>
    </div>
  );
}
