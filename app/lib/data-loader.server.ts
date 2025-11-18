import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Load proverbs (short sentences) from file
 */
export async function loadProverbs(language: "ko" | "en"): Promise<string[]> {
  const filename = language === "ko" ? "PROVERB.KOR" : "PROVERB.ENG";
  const filePath = join(process.cwd(), "public", filename);

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    return lines;
  } catch (error) {
    console.error(`Error loading proverbs from ${filename}:`, error);
    return [];
  }
}

/**
 * Load words for Venice game
 */
export async function loadWords(language: "ko" | "en"): Promise<string[]> {
  const filename = language === "ko" ? "WORD.KOR" : "WORD.ENG";
  const filePath = join(process.cwd(), "public", filename);

  try {
    const content = await readFile(filePath, "utf-8");
    const words = content
      .split(/\s+/)
      .map((word) => word.trim())
      .filter((word) => word.length > 0);

    return words;
  } catch (error) {
    console.error(`Error loading words from ${filename}:`, error);
    return [];
  }
}

/**
 * Long text metadata
 */
export interface LongText {
  id: string;
  title: string;
  language: "ko" | "en";
  filename: string;
}

/**
 * Get list of available long texts
 */
export async function getLongTextList(language: "ko" | "en"): Promise<LongText[]> {
  if (language === "ko") {
    const textList: LongText[] = [];

    for (let i = 1; i <= 10; i++) {
      const id = `kor${String(i).padStart(2, "0")}`;
      const filename = `${id}.txt`;
      const filePath = join(process.cwd(), "public", filename);

      let title = `한국어 장문 ${i}`;
      try {
        const content = await readFile(filePath, "utf-8");
        const firstLine = content.split("\n")[0]?.trim();
        if (firstLine) {
          title = firstLine;
        }
      } catch (error) {
        console.error(`Error reading title from ${filename}:`, error);
      }

      textList.push({
        id,
        title,
        language: "ko" as const,
        filename,
      });
    }

    return textList;
  } else {
    const englishFiles = [
      { id: "alice", filename: "ALICE.TXE" },
      { id: "ant", filename: "ANT.TXE" },
      { id: "mouse", filename: "MOUSE.TXE" },
      { id: "peterpan", filename: "PETERPAN.TXE" },
      { id: "pig", filename: "PIG.TXE" },
      { id: "tailor", filename: "TAILOR.TXE" },
    ];

    const textList: LongText[] = [];

    for (const file of englishFiles) {
      const filePath = join(process.cwd(), "public", file.filename);
      let title = file.id;

      try {
        const content = await readFile(filePath, "utf-8");
        const firstLine = content.split("\n")[0]?.trim();
        if (firstLine) {
          title = firstLine;
        }
      } catch (error) {
        console.error(`Error reading title from ${file.filename}:`, error);
      }

      textList.push({
        id: file.id,
        title,
        language: "en" as const,
        filename: file.filename,
      });
    }

    return textList;
  }
}

/**
 * Load long text content
 */
export async function loadLongText(
  id: string,
  language: "ko" | "en"
): Promise<{ title: string; content: string } | null> {
  const textList = await getLongTextList(language);
  const textInfo = textList.find((t) => t.id === id);

  if (!textInfo) {
    return null;
  }

  const filePath = join(process.cwd(), "public", textInfo.filename);

  try {
    const content = await readFile(filePath, "utf-8");
    const lines = content.split("\n");

    if (language === "ko") {
      // Korean files: first line is title, second might be author
      const title = lines[0]?.trim() || textInfo.title;
      const fullContent = content.trim();

      return { title, content: fullContent };
    } else {
      // English TXE files: first line is title
      const title = lines[0]?.trim() || textInfo.title;
      const fullContent = content.trim();

      return { title, content: fullContent };
    }
  } catch (error) {
    console.error(`Error loading long text ${id}:`, error);
    return null;
  }
}

/**
 * Get random items from array
 */
export function getRandomItems<T>(array: T[], count: number): T[] {
  const shuffled = [...array].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}
