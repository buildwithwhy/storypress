import { firstQuestion, initialStory, sampleMemory, samplePaper, sampleSource, type Paper, type Source, type Story } from "./story";

type SampleEdition = { name: string; memory: string; followup: string; paper: Paper; source: Source };
export const sampleEditions: Record<Story["language"], SampleEdition> = {
  en: { name: "Alex", memory: sampleMemory, followup: "What do you remember your grandmother doing that evening?", paper: samplePaper, source: sampleSource },
  zh: {
    name: "亚历克斯",
    memory: "1969年7月，我九岁。为了看登月直播，全家人都挤进了外婆在纽约皇后区的客厅。她家有我们全家唯一的一台电视。我记得自己和表兄弟姐妹们坐在地毯上。外婆一盘接一盘地端来吃的，仿佛宇航员要来家里吃晚饭。",
    followup: "那天晚上，你还记得外婆在做些什么吗？",
    paper: {
      headline: "一间小客厅，一个新世界。",
      standfirst: "皇后区的一台电视，让一家人聚在外婆的客厅里。那一夜，世界仿佛也来到了他们身边。",
      paragraphs: ["1969年7月，我九岁。为了看登月直播，全家人都挤进了外婆在纽约皇后区的客厅。她家有我们全家唯一的一台电视。", "我记得自己和表兄弟姐妹们坐在地毯上。外婆一盘接一盘地端来吃的，仿佛宇航员要来家里吃晚饭。"],
      quote: "外婆一盘接一盘地端来吃的，仿佛宇航员要来家里吃晚饭。",
    },
    source: { ...sampleSource, title: "全世界一起仰望月球的夜晚", date: "1969年7月20日", description: "NASA的回顾文章记录了1969年7月20日阿波罗11号登月，以及随后进行的首次月球漫步，为记忆中的电视直播提供了历史背景。", connection: "你记得和家人一起，在皇后区看登月直播。", question: "回想那台电视，画面出现时，你记得大家都在做什么吗？" },
  },
  es: {
    name: "Alex",
    memory: "En julio de 1969 tenía nueve años. Toda la familia se apretujó en la sala de mi abuela, en Queens, para ver la llegada a la Luna. Ella tenía el único televisor de la familia. Recuerdo que estaba en la alfombra con mis primos. Mi abuela no paraba de traer platos de comida, como si los astronautas fueran a venir a cenar.",
    followup: "¿Qué recuerdas que hacía tu abuela aquella noche?",
    paper: {
      headline: "Una sala pequeña. Un mundo nuevo.",
      standfirst: "Un televisor reunió a toda una familia en Queens. Aquella noche, el mundo llegó hasta la sala de la abuela.",
      paragraphs: ["En julio de 1969 tenía nueve años. Toda la familia se apretujó en la sala de mi abuela, en Queens, para ver la llegada a la Luna. Ella tenía el único televisor de la familia.", "Recuerdo que estaba en la alfombra con mis primos. Mi abuela no paraba de traer platos de comida, como si los astronautas fueran a venir a cenar."],
      quote: "Mi abuela no paraba de traer platos de comida, como si los astronautas fueran a venir a cenar.",
    },
    source: { ...sampleSource, title: "La noche en que el mundo miró a la Luna", date: "20 de julio de 1969", description: "El relato de la NASA recuerda el alunizaje del Apolo 11 el 20 de julio de 1969 y el primer paseo lunar que le siguió. Aporta contexto histórico a aquella transmisión televisiva.", connection: "Recuerdas haber visto la llegada a la Luna con tu familia en Queens.", question: "Al recordar aquel televisor, ¿qué hacía cada uno cuando apareció la imagen?" },
  },
};

export function createSampleStory(language: Story["language"]): Story {
  const sample = sampleEditions[language];
  return { ...initialStory, language, name: sample.name, sample: true, turns: [{ role: "assistant", text: firstQuestion[language] }, { role: "user", text: sample.memory }, { role: "assistant", text: sample.followup }] };
}

export const presentation = {
  en: {
    eyebrow: "THE LITTLE THINGS. THE BIG MOMENTS.", previewLabel: "YOUR ORDINARY, EXTRAORDINARY LIFE", previewAria: "Example personal newspaper", stickerTop: "Made of", stickerBottom: "your memories.", caption: "A fictional story. A real piece of history.",
    steps: [{ title: "A little conversation", description: "One thoughtful question at a time." }, { title: "A spark of recognition", description: "Discover the world around your memory." }, { title: "Something to keep", description: "Your words, beautifully brought together." }],
    footer: "Made with your memories. Kept in your voice.", sampleBanner: "Fictional sample story · curated historical source · no live search", tryOwn: "Try your own", replaceSample: "Replace this draft with the fictional sample? Download your original words first if you want to keep them.",
    masthead: "The Storypress", topline: "THE STORIES THAT MAKE US", edition: "PERSONAL EDITION · NO. 01", unnamed: "A life, in your own words", sample: "FICTIONAL SAMPLE", reviewed: "REVIEWED BY THE STORYTELLER", draft: "DRAFT · FOR YOUR REVIEW", kickers: { life: "FROM THE FAMILY ARCHIVE", wedding: "A LOVE STORY", graduation: "THE NEXT CHAPTER" }, illustration: "THE NIGHT WE LOOKED UP", decoration: "Decorative illustration", photo: "Photograph supplied by the storyteller", kept: "A little piece of a life.", colophon: "YOUR WORDS. YOUR WORLD.", madeWith: "Made with Storypress",
    paperEyebrow: "SOMETHING TO KEEP", paperTitle: "Your story, in print.", paperIntro: "Read it slowly. Make it yours. Keep the details that matter.", headline: "Headline", introduction: "Introduction", paragraphs: "Your story (a blank line starts a new paragraph)", quote: "Pull quote (use your own exact words)", compare: "Compare with my original words", downloadWords: "Download original words", downloadStory: "Download full story", original: "Your original words", asTold: "AS YOU TOLD IT", making: "Giving your story its own front page…",
  },
  zh: {
    eyebrow: "平凡小事，人生大事。", previewLabel: "平凡的日子，不平凡的人生", previewAria: "个人故事报纸示例", stickerTop: "这里珍藏着", stickerBottom: "你的回忆。", caption: "一个虚构的故事，一段真实的历史。",
    steps: [{ title: "从聊聊天开始", description: "一次一个问题，慢慢找回细节。" }, { title: "唤起一点熟悉的感觉", description: "重访记忆里的那个世界。" }, { title: "留下一份珍藏", description: "把你的话，编成属于你的故事。" }],
    footer: "珍藏你的回忆，保留你的声音。", sampleBanner: "虚构故事示例 · 精选历史资料 · 未进行实时搜索", tryOwn: "讲讲你自己的故事", replaceSample: "要用虚构示例替换当前草稿吗？如果想保留草稿，请先下载你的原话。",
    masthead: "人生故事报", topline: "故事里，有我们的人生", edition: "个人珍藏版 · 第01期", unnamed: "用自己的话，讲自己的人生", sample: "虚构故事示例", reviewed: "讲述者已确认", draft: "草稿 · 请你审阅", kickers: { life: "来自家庭记忆", wedding: "我们的爱情故事", graduation: "人生的新篇章" }, illustration: "那一夜，我们一起仰望", decoration: "装饰插画", photo: "讲述者提供的照片", kept: "人生的一小段，值得珍藏。", colophon: "你的话语，你的世界。", madeWith: "由 Storypress 制作",
    paperEyebrow: "留下一份珍藏", paperTitle: "你的故事，跃然纸上。", paperIntro: "慢慢读，改成你喜欢的样子，留下那些重要的细节。", headline: "标题", introduction: "导语", paragraphs: "你的故事（空一行开始新段落）", quote: "精选原话（请保留你的原句）", compare: "对照我最初说的话", downloadWords: "下载我的原话", downloadStory: "下载完整故事", original: "你的原话", asTold: "正如你所讲述的", making: "正在为你的故事制作头版……",
  },
  es: {
    eyebrow: "PEQUEÑOS DETALLES. GRANDES MOMENTOS.", previewLabel: "TU VIDA COTIDIANA, EXTRAORDINARIA", previewAria: "Ejemplo de periódico personal", stickerTop: "Hecho de", stickerBottom: "tus recuerdos.", caption: "Una historia ficticia. Un pedacito de historia real.",
    steps: [{ title: "Una pequeña conversación", description: "Una pregunta a la vez, con calma." }, { title: "Algo que te resulta familiar", description: "Redescubre el mundo de tus recuerdos." }, { title: "Algo para conservar", description: "Tus palabras, reunidas con cariño." }],
    footer: "Hecho con tus recuerdos. Contado con tu voz.", sampleBanner: "Historia ficticia · fuente histórica seleccionada · sin búsqueda en directo", tryOwn: "Cuenta la tuya", replaceSample: "¿Sustituir este borrador por el ejemplo ficticio? Descarga primero tus palabras si quieres conservarlas.",
    masthead: "El Storypress", topline: "LAS HISTORIAS QUE NOS HACEN", edition: "EDICIÓN PERSONAL · N.º 01", unnamed: "Una vida, con tus palabras", sample: "EJEMPLO FICTICIO", reviewed: "REVISADO POR QUIEN LO CONTÓ", draft: "BORRADOR · PARA TU REVISIÓN", kickers: { life: "DEL ARCHIVO FAMILIAR", wedding: "UNA HISTORIA DE AMOR", graduation: "EL PRÓXIMO CAPÍTULO" }, illustration: "AQUELLA NOCHE MIRAMOS AL CIELO", decoration: "Ilustración decorativa", photo: "Fotografía de quien cuenta la historia", kept: "Un pedacito de una vida.", colophon: "TUS PALABRAS. TU MUNDO.", madeWith: "Hecho con Storypress",
    paperEyebrow: "ALGO PARA CONSERVAR", paperTitle: "Tu historia, en papel.", paperIntro: "Léela con calma. Hazla tuya. Conserva los detalles que importan.", headline: "Titular", introduction: "Introducción", paragraphs: "Tu historia (deja una línea en blanco entre párrafos)", quote: "Cita destacada (usa tus palabras exactas)", compare: "Comparar con mis palabras originales", downloadWords: "Descargar mis palabras", downloadStory: "Descargar la historia completa", original: "Tus palabras originales", asTold: "TAL COMO LO CONTASTE", making: "Tu historia está tomando forma en la portada…",
  },
};
