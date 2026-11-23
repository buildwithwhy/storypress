import {type Story} from './story';

// The support address the terms name for account deletion and billing help
// (terms §deletion, §cancellation): one constant so the /billing page and the
// legal pages can never drift apart.
export const supportEmail='yuyu@hopperlace.ai';

// LEGAL PAGES — FOUNDER-APPROVED DRAFTS, NOT LEGAL ADVICE.
//
// This module carries the /terms, /privacy and /refunds page copy in the
// app's shared en/zh/es copy-object pattern. These pages are founder-approved
// drafts that still require review by a qualified solicitor before they are
// treated as final. This reminder is intentionally kept here, out of public
// view: the on-page draft banner was removed for launch (Nov 2026) and must
// stay out of the public pages until that solicitor review is complete.
//
// Product statements are grounded in the repo as of the Nov 2026 draft: free
// allowance defaults to 3 stories (server/storage.ts freeStoryLimit), the
// paid fair-use cap defaults to 50 stories started per UTC calendar month
// (server/storage.ts subscriptionMonthlyCap, STORYPRESS_SUBSCRIPTION_MONTHLY_CAP),
// pack credits are one-time and never expire (paywall copy, pack grants),
// original recordings stay on the device and are never uploaded raw to the
// database (lib/recording-vault.ts), photos live inside private story data in
// Supabase Postgres rather than a storage bucket (server/storage.ts), and the
// AI providers are Google Gemini (Vertex AI / AI Studio), Qwen via OpenRouter
// for Chinese story text, and Nimble for public web research (docs/MODELS.md,
// lib/providers.ts). Payments run through Stripe; sign-in codes are delivered
// through Supabase Auth over Resend SMTP (docs/EMAIL-SIGN-IN.md).

export type LegalPageId = 'terms' | 'privacy' | 'refunds';
export type LegalSection = {heading: string; paragraphs: string[]; question?: boolean};
export type LegalPageCopy = {title: string; updated: string; intro: string; sections: LegalSection[]};
export type LegalCopy = {
  questionLabel: string;
  backHome: string;
  readAlso: string;
  links: Record<LegalPageId, string>;
  checkoutConsentLabel: string; // suggested checkout consent checkbox text (see PricingPanel)
  pricingLegalLine: string;
  pages: Record<LegalPageId, LegalPageCopy>;
};

// Legal-page routing helper: which legal page (if any) a pathname serves.
export function legalPageFromPath(path: string): LegalPageId | null {
  return path === '/terms' || path === '/privacy' || path === '/refunds' ? (path.slice(1) as LegalPageId) : null;
}

export const legalCopy: Record<Story['language'], LegalCopy> = {
  en: {
    questionLabel: 'QUESTION FOR FOUNDER',
    backHome: 'Back to Once & Ours',
    readAlso: 'Related',
    links: {terms: 'Terms of Service', privacy: 'Privacy Notice', refunds: 'Refunds & cancellation'},
    checkoutConsentLabel: 'I ask Once & Ours to start supplying the digital content immediately, and I acknowledge that once supply begins I lose my 14-day right to cancel this purchase.',
    pricingLegalLine: 'Subscriptions renew automatically and you can cancel any time. See our terms, privacy notice, and refunds & cancellation.',
    pages: {
      terms: {
        title: 'Terms of Service',
        updated: 'Last updated 22 November 2026',
        intro: 'These terms set out the ground rules for using Once & Ours, a personal storytelling service operated by HOPPERLACE LTD.',
        sections: [
          {heading: 'Who we are and what the service does', paragraphs: [
            'Once & Ours is a personal storytelling app. You share a memory by typing, dictating, or talking through a live spoken interview, and the service helps you shape it into an illustrated keepsake — a newspaper, booklet, or letter you can read, edit, download, print, and share with people you choose. The service offers AI-assisted interviewing, translation between English, Simplified Chinese, and Spanish, AI-generated illustration, and optional research that surfaces public historical context related to what you have told it.',
            'The service is operated by HOPPERLACE LTD, company number 16532585, whose registered office is at 71-75 Shelton Street, Covent Garden, London WC2H 9JQ ("we", "us"). The service is available at https://www.onceandours.com. You can reach us at yuyu@hopperlace.ai.',
          ]},
          {heading: 'Accounts', paragraphs: [
            'To save your stories to your account you sign in with an email code or a Google account. You are responsible for keeping access to your email address safe, for the words and photographs you upload, and for using the service lawfully. Guest work stays in your browser until you sign in.',
          ]},
          {heading: 'Acceptable use', paragraphs: [
            'You agree not to use the service to create content that is unlawful, harmful, or infringes other people\u2019s rights; not to upload photographs of people who would not reasonably consent; not to attempt to access other people\u2019s data, overload the service, or reverse-engineer it beyond what the law allows; and not to use the service to generate content that pretends to be a real person\u2019s authentic account of events in a way that deceives readers. We may suspend accounts that seriously breach these rules; where this happens, you keep access to the words and photographs you saved.',
          ]},
          {heading: 'Your stories and AI-generated content', paragraphs: [
            'You own the words and photographs you contribute. AI-generated illustrations are clearly labelled as illustration. AI output is generated automatically and may be inaccurate, incomplete, or not to your taste — you should review every keepsake before you share it, and edited AI illustrations and translations remain subject to those limits. You grant us only the limited permission needed to store, process, and display your content in order to run the service for you (for example, passing your recorded words to an AI provider to transcribe them, or your photograph to generate the illustration you asked for). We do not use your private story content to advertise to other people.',
            'AI-generated illustrations are licensed to you, royalty-free, for use in the keepsakes you create — print, share, and keep them without further payment. We do not claim ownership of AI-generated illustrations and make no promise that any illustration is unique or protected by copyright.',
          ]},
          {heading: 'Free stories, subscriptions, and the monthly fair-use cap', paragraphs: [
            'You can try the service for free: 3 free stories before a paid plan is needed to keep telling new stories. Paid plans are a monthly or annual subscription, priced in US dollars as shown at checkout.',
            'A subscription covers up to 50 stories you start in each calendar month (measured in UTC). This fair-use cap keeps the service fast and affordable for everyone; unused capacity does not roll over. Everything you have already made stays yours to read, print, and share whichever plan you are on.',
          ]},
          {heading: 'Credit packs', paragraphs: [
            'Credit packs are one-time purchases of 30 or 100 additional story credits. Pack credits never expire and sit in your account beside your plan allowance, so they can carry you through a busy month or outlast a subscription entirely.',
          ]},
          {heading: 'Renewal and cancellation of subscriptions', paragraphs: [
            'Subscriptions renew automatically at the end of each billing period — monthly plans monthly, annual plans yearly — until you cancel. You can cancel at any time, self-serve, through the Manage billing link (the Stripe customer portal) in the app. Cancelling stops future renewals; you keep full access until the end of the period you have already paid for, and you are not charged again after that. Credit packs you have bought are unaffected.',
          ]},
          {heading: 'Your cancellation right, and the immediate-start exception', paragraphs: [
            'If you buy from us as a consumer in the UK, consumer law gives you 14 days from the day of purchase to cancel most purchases and receive a full refund — including digital content, provided you have not agreed to its supply starting straight away.',
            'Because Once & Ours is digital and starts working the moment you pay, at checkout we ask for your express consent to start supply immediately. If you give that consent and supply begins, you acknowledge the 14-day cancellation right is lost for that purchase, as the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 allow. The consent checkbox is shown just before payment — the same wording appears in our refunds & cancellation page. If you do not give consent, you keep the 14-day right and we begin supply only after it expires.',
          ]},
          {heading: 'Disclaimers and liability', paragraphs: [
            'The service is provided with reasonable skill and care. AI features are automatic and can be wrong; the service is not a professional archive, genealogy, legal, or medical service, and keepsakes should not be relied on as authoritative records. Nothing in these terms limits liability for death or personal injury caused by negligence, for fraud, or for anything else the law does not allow to be limited. Otherwise our total liability for the service is limited to the amount you paid us in the 12 months before the claim.',
          ]},
          {heading: 'Changes, governing law, and contact', paragraphs: [
            'These terms may change; material changes will be announced in the app. These terms are governed by the laws of England and Wales, and UK consumer rights you have under statute are unaffected by anything here. Questions, complaints, and refund requests: yuyu@hopperlace.ai.',
          ]},
        ],
      },
      privacy: {
        title: 'Privacy Notice',
        updated: 'Last updated 22 November 2026',
        intro: 'This notice explains what Once & Ours collects, where it lives, who helps us process it, and the rights you have under UK GDPR. Once & Ours is operated by HOPPERLACE LTD (company number 16532585, 71-75 Shelton Street, Covent Garden, London WC2H 9JQ). Contact: yuyu@hopperlace.ai.',
        sections: [
          {heading: 'What we collect', paragraphs: [
            'Your account details: the email address you sign in with (by email code or Google) and the identifiers your sign-in provider returns.',
            'Your stories: the words of your interview, your edited keepsake text, its translations, and your choices of artwork — saved as private story data in your account.',
            'Photographs: if you add one, your photo is stored inside that private story data. It is not placed in a separate public storage area.',
            'Voice recordings: when you record or dictate an answer, the audio is processed to turn it into text. The original recording stays on your own device, in your browser, and raw audio is never uploaded to our database. Only the transcribed words are saved with your story.',
            'Billing and usage records: your plan, the count of stories you have created and pack credits remaining, and minimal AI-usage counters that enforce the daily and monthly limits — kept so the paywall is accurate and honest, not for profiling you.',
          ]},
          {heading: 'Where your data lives', paragraphs: [
            'Story and account data are stored in Supabase (hosted Postgres), tied to your account. Private means private: your stories are readable only by you, except when you deliberately create a share link — those links are unlisted and revocable, and sharing is not public search. The service does not sell your data, and there is no advertising.',
          ]},
          {heading: 'How AI is used, and who helps us', paragraphs: [
            'The AI features — interviewing, transcription of recordings, translation, photo interpretation, research planning, writing assistance, and illustration — send just the material needed for that step to our AI providers. Google (Gemini, via Google Cloud Vertex AI or AI Studio) handles most tasks; for stories told in Chinese, text generation can route to Qwen through OpenRouter; optional historical research uses Nimble to find public web sources. Photographs are sent for interpretation only when you choose to use that feature. Illustrations are AI-generated and always labelled as illustration.',
            'Nimble is a third-party processor that carries out this historical-research step on our instructions; it is the discovery provider in use today.',
          ]},
          {heading: 'Payments and email delivery', paragraphs: [
            'Payments and subscriptions are handled by Stripe. Your card details go to Stripe, not to us — we keep only your plan state and the identifiers Stripe needs to recognise your subscription. Sign-in codes are delivered by email through Supabase Auth using Resend as the sending service.',
          ]},
          {heading: 'Retention and deletion', paragraphs: [
            'Your stories and photographs are kept until you or the law ask us to remove them. Deleting a story from My stories removes it and its photograph. Deleting your account removes your stories, photographs, and account data.',
            'There is no self-serve account-deletion flow in the app yet. Until one ships, you can have your account and its data deleted by emailing yuyu@hopperlace.ai; we will complete the deletion within 30 days of your request. This email-based process is interim and will be replaced when in-app deletion ships.',
          ]},
          {heading: 'Your rights under UK GDPR', paragraphs: [
            'You have the right to be told how your data is used (this notice); to see a copy of it; to have inaccurate data corrected; to have it erased; to object to or restrict some processing; to have your data ported to another service where the law allows; and to complain to the Information Commissioner\u2019s Office (ico.org.uk). To exercise any right, or to ask anything at all about your data, write to yuyu@hopperlace.ai.',
          ]},
        ],
      },
      refunds: {
        title: 'Refunds & cancellation',
        updated: 'Last updated 22 November 2026',
        intro: 'This page explains how to cancel a subscription, what happens to credit packs, and when refunds are given. Once & Ours is operated by HOPPERLACE LTD (company number 16532585, 71-75 Shelton Street, Covent Garden, London WC2H 9JQ). Contact: yuyu@hopperlace.ai.',
        sections: [
          {heading: 'Cancelling a subscription', paragraphs: [
            'You can cancel any time, self-serve, through the Manage billing link in the app — this opens the Stripe customer portal, where subscriptions and invoices are managed. You do not need to email us to cancel, and we do not charge a cancellation fee.',
            'Cancelling takes effect at the end of your current billing period. If you cannot use the Manage billing link for any reason, email yuyu@hopperlace.ai and we will handle the cancellation or any billing change for you.',
          ]},
          {heading: 'What cancelling does', paragraphs: [
            'Cancelling stops the next renewal. You keep full access to your plan\u2019s features until the end of the period you have already paid for; after that, your account continues on the free tier and everything you have made stays yours to read, print, and share. Credit packs you have bought are yours regardless of your plan.',
          ]},
          {heading: 'Credit packs never expire', paragraphs: [
            'Pack credits are one-time purchases and never expire — use them now or in years\u2019 time. They are not subscriptions, so there is nothing to cancel.',
          ]},
          {heading: 'The 14-day cancellation right, and the immediate-start exception', paragraphs: [
            'As a UK consumer you normally have 14 days from purchase to cancel and receive a full refund. Once & Ours is digital content that starts working the moment you pay, so at checkout we ask for your express consent to begin supply immediately. If you give that consent, the 14-day right does not apply to that purchase once supply begins, as the Consumer Contracts (Information, Cancellation and Additional Charges) Regulations 2013 allow. The checkout checkbox says this in plain words before you pay.',
          ]},
          {heading: 'Goodwill refunds', paragraphs: [
            'Even outside the statutory window, if something went wrong — a double charge, a story credit that did not arrive, or you bought by mistake and have barely used the service — write to yuyu@hopperlace.ai. Goodwill refunds are granted at the founder\u2019s discretion; we would rather lose a fee than leave you unfairly out of pocket.',
          ]},
          {heading: 'How refunds are paid', paragraphs: [
            'Approved refunds go back to your original payment method through Stripe. If you are unhappy with the outcome of a refund request, you can complain to us at yuyu@hopperlace.ai and, for UK consumers, to the Information Commissioner\u2019s Office or via your statutory rights.',
          ]},
        ],
      },
    },
  },
  zh: {
    questionLabel: '创始人待确认问题',
    backHome: '回到 Once & Ours',
    readAlso: '相关页面',
    links: {terms: '服务条款', privacy: '隐私声明', refunds: '退款与取消'},
    checkoutConsentLabel: '我请求 Once & Ours 立即开始提供数字内容，并确认：供应一经开始，我将失去本次购买的14天冷静期取消权。',
    pricingLegalLine: '订阅会自动续期，你可随时取消。请参阅服务条款、隐私声明与退款与取消页面。',
    pages: {
      terms: {
        title: '服务条款',
        updated: '最后更新于2026年11月22日',
        intro: '本条款规定了使用 Once & Ours（一款个人叙事应用）的基本规则，运营方为 HOPPERLACE LTD。',
        sections: [
          {heading: '我们是谁，服务是什么', paragraphs: [
            'Once & Ours 是一款个人叙事应用。你可以通过打字、口述或实时语音访谈来讲述一段回忆，服务会帮你把它整理成一份配有插图的纪念作品——报纸、小册子或信件，可以阅读、编辑、下载、打印，并分享给你选择的人。服务提供 AI 辅助访谈、英语/简体中文/西班牙语互译、AI 插图生成，以及可选的历史背景检索（仅查找公开资料）。',
            '本服务由 HOPPERLACE LTD（公司注册号 16532585，注册办事处：71-75 Shelton Street, Covent Garden, London WC2H 9JQ，下称"我们"）运营，服务网址为 https://www.onceandours.com。联系方式：yuyu@hopperlace.ai。',
          ]},
          {heading: '账户', paragraphs: [
            '要把故事保存到账户，请使用邮箱验证码或 Google 账户登录。你有责任保管好自己的邮箱安全，对你上传的文字和照片负责，并合法使用本服务。访客作品在你登录前只保存在浏览器中。',
          ]},
          {heading: '合理使用', paragraphs: [
            '你同意：不利用本服务制作违法、有害或侵犯他人权利的内容；不上传他人不会合理同意的照片；不尝试访问他人数据、不使服务过载、不在法律允许范围之外对服务进行逆向工程；不利用本服务生成冒充真实人物对事件的亲述从而误导读者的内容。对于严重违反上述规则的用户，我们可能暂停其账户；即使如此，你仍可访问已保存的文字和照片。',
          ]},
          {heading: '你的故事与 AI 生成内容', paragraphs: [
            '你贡献的文字和照片归你所有。AI 生成的插图会明确标注为插图。AI 输出为自动生成，可能不准确、不完整或不如预期——分享前请务必审阅；经编辑的 AI 插图和译文同样受此限制。你仅授予我们为运营服务而存储、处理和展示你的内容所必需的有限许可（例如：把你录下的话传给 AI 服务商以转写文字，或把你选择的照片用于生成你所要求的插图）。我们不会利用你的私人故事内容向其他人投放广告。',
            'AI 生成的插图以免版税许可的方式提供给你，可用于你制作的纪念品——可随时打印、分享和保存，无需另行付费。我们不对 AI 生成插图主张所有权，也不承诺任何插图具有独特性或受版权保护。',
          ]},
          {heading: '免费故事、订阅与每月公平用量上限', paragraphs: [
            '你可以免费试用：创作 3 个免费故事；之后需付费方案才能继续创作新故事。付费方案为按月或按年订阅，价格以美元计，以结账页面显示为准。',
            '订阅方案每个日历月（按 UTC 计算）最多可开始创作 50 个故事。此公平用量上限是为了让服务对所有人都保持快速和可负担；未用完的额度不结转。无论使用哪种方案，你已创作的一切都永远归你，可随时阅读、打印和分享。',
          ]},
          {heading: '故事点数包', paragraphs: [
            '点数包为一次性购买，含 30 或 100 个故事点数。点数永不过期，与你的方案额度并存，既可用于繁忙的月份，也可独立于订阅长期保留。',
          ]},
          {heading: '订阅的续期与取消', paragraphs: [
            '订阅在每个计费周期结束时自动续期——按月方案每月续期，按年方案每年续期——直至你取消。你可以随时通过应用内的"管理订阅"链接（Stripe 客户门户）自助取消。取消后不再续期；你仍可完整使用至已付费周期结束，此后不再扣款。已购买的点数包不受影响。',
          ]},
          {heading: '冷静期取消权与"立即开始供应"的例外', paragraphs: [
            '作为英国消费者，依据消费者保护法律，多数购买行为自购买之日起14天内可取消并获得全额退款——数字内容亦然，前提是你未同意其立即开始供应。',
            '由于 Once & Ours 属于数字内容且付费后立即生效，我们会在结账时请求你明确同意立即开始供应。如你作出该同意且供应已开始，即确认该次购买不再享有14天冷静期取消权（依据《2013年消费者合同（信息、取消和附加费用）条例》所允许）。该同意勾选框会在付款前显示——其措辞与"退款与取消"页面一致。如你不作出同意，你保留14天取消权，我们将在期满后才开始供应。',
          ]},
          {heading: '免责声明与责任', paragraphs: [
            '我们以合理的专业与谨慎提供服务。AI 功能为自动生成，可能出现错误；本服务并非专业的档案、族谱、法律或医疗服务，纪念作品不应被当作权威记录依赖。本条款不限制因过失导致死亡或人身伤害、欺诈或法律不允许限制的其他事项的责任。除此之外，我们对服务的赔偿责任总额以索赔前12个月内你向我们支付的金额为限。',
          ]},
          {heading: '条款变更、适用法律与联系方式', paragraphs: [
            '本条款可能变更；重大变更将在应用内公布。本条款适用英格兰和威尔士法律；你依英国成文法享有的消费者权利不受本条款任何内容影响。问题、投诉与退款申请请发送至：yuyu@hopperlace.ai。',
          ]},
        ],
      },
      privacy: {
        title: '隐私声明',
        updated: '最后更新于2026年11月22日',
        intro: '本声明说明 Once & Ours 收集哪些信息、存放于何处、由哪些服务方协助处理，以及你依英国 GDPR 享有的权利。Once & Ours 由 HOPPERLACE LTD 运营（公司注册号 16532585，注册办事处：71-75 Shelton Street, Covent Garden, London WC2H 9JQ）。联系方式：yuyu@hopperlace.ai。',
        sections: [
          {heading: '我们收集什么', paragraphs: [
            '账户信息：你登录所用的邮箱地址（邮箱验证码或 Google），以及登录服务方返回的标识符。',
            '你的故事：访谈中的文字、你编辑后的纪念作品文本、译文及插图选择——作为私人故事数据保存在你的账户中。',
            '照片：如你添加照片，照片将保存在该私人故事数据之内，不会放入单独的公开存储区。',
            '语音录音：当你录制或口述回答时，音频经处理转为文字。原始录音只保存在你自己的设备（浏览器）中，原始音频绝不上传至我们的数据库。与故事一同保存的只有转写出的文字。',
            '账单与用量记录：你的方案、已创作故事数、剩余点数，以及用于执行每日/每月限额的最小 AI 用量计数——保留这些是为了让付费状态准确诚实，而非用于对你进行画像。',
          ]},
          {heading: '数据存放在哪里', paragraphs: [
            '故事与账户数据存储在 Supabase（托管 Postgres）中，与你的账户绑定。私人即意味着私密：你的故事只有你能读取，除非你主动创建分享链接——此类链接不公开列出且可随时撤销，分享也不提供公开搜索。我们不出售你的数据，也没有任何广告。',
          ]},
          {heading: 'AI 的使用方式与协助我们的服务方', paragraphs: [
            'AI 功能——访谈、录音转写、翻译、照片解读、检索规划、写作辅助和插图——仅将该步骤所需的材料发送给我们的 AI 服务商。大部分任务由 Google（Gemini，经 Google Cloud Vertex AI 或 AI Studio）处理；以中文讲述的故事，文字生成可经 OpenRouter 路由至 Qwen；可选的历史背景检索使用 Nimble 查找公开网页资料。照片仅在你选择使用该功能时才会被发送用于解读。插图为 AI 生成，并始终标注为插图。',
            'Nimble 是第三方服务方，受我们委托执行历史背景检索这一步骤；它是当前在用的检索服务提供方。',
          ]},
          {heading: '支付与邮件送达', paragraphs: [
            '支付与订阅由 Stripe 处理。你的银行卡信息发送给 Stripe 而非我们——我们只保存你的方案状态以及 Stripe 识别订阅所需的标识符。登录验证码通过 Supabase Auth 经 Resend 发送。',
          ]},
          {heading: '保留与删除', paragraphs: [
            '你的故事和照片会一直保留，直到你或法律要求我们删除。在"我的故事"中删除故事即会连同其照片一并删除。删除账户将删除你的故事、照片和账户数据。',
            '应用内自助删除账户的功能尚未上线。在此之前，你可以发邮件至 yuyu@hopperlace.ai 申请删除账户及其数据，我们会在收到申请后 30 天内完成删除。此邮件方式为过渡安排，待应用内删除功能上线后将予替换。',
          ]},
          {heading: '你在英国 GDPR 下的权利', paragraphs: [
            '你有以下权利：了解数据如何被使用（即本声明）、获取数据副本、更正不准确的数据、删除数据、对部分处理提出异议或要求限制、在法律允许时将数据迁移至其他服务，以及向信息专员办公室（ico.org.uk）投诉。行使任何权利，或就你的数据提出任何问题，请致函 yuyu@hopperlace.ai。',
          ]},
        ],
      },
      refunds: {
        title: '退款与取消',
        updated: '最后更新于2026年11月22日',
        intro: '本页面说明如何取消订阅、点数包如何处理、何种情况下退款。Once & Ours 由 HOPPERLACE LTD 运营（公司注册号 16532585，注册办事处：71-75 Shelton Street, Covent Garden, London WC2H 9JQ）。联系方式：yuyu@hopperlace.ai。',
        sections: [
          {heading: '取消订阅', paragraphs: [
            '你可随时通过应用内的"管理订阅"链接自助取消——该链接会打开 Stripe 客户门户，订阅与发票均在此管理。取消无需发邮件给我们，我们也不收取任何取消费用。',
            '取消在当前计费周期结束时生效。如因任何原因无法使用“管理订阅”链接，请发邮件至 yuyu@hopperlace.ai，我们会为你办理取消或任何账单变更。',
          ]},
          {heading: '取消后会发生什么', paragraphs: [
            '取消即停止下次续期。你仍可完整使用已付费周期内的方案功能；到期后，你的账户转为免费方案，你已创作的一切仍归你所有，可随时阅读、打印和分享。已购买的点数包与方案无关，始终属于你。',
          ]},
          {heading: '点数包永不过期', paragraphs: [
            '点数包为一次性购买且永不过期——现在用或多年后用均可。它不是订阅，因此无需取消。',
          ]},
          {heading: '14天冷静期取消权与"立即开始供应"的例外', paragraphs: [
            '作为英国消费者，你通常自购买之日起14天内可取消并获得全额退款。Once & Ours 属于付费后立即生效的数字内容，因此我们在结账时请求你明确同意立即开始供应。如你作出该同意，供应开始后该次购买即不适用14天取消权（依据《2013年消费者合同（信息、取消和附加费用）条例》所允许）。结账勾选框会在付款前以平实语言说明这一点。',
          ]},
          {heading: '善意退款', paragraphs: [
            '即使在法定期限之外，如果出现了问题——重复扣款、故事点数未到账，或你误购且几乎未使用服务——请致函 yuyu@hopperlace.ai。善意退款由创始人酌情决定；我们宁可损失一笔费用，也不愿让你蒙受不应有的损失。',
          ]},
          {heading: '退款如何支付', paragraphs: [
            '经批准的退款将通过 Stripe 退回你原来的付款方式。如你对退款结果不满，可向 yuyu@hopperlace.ai 投诉；作为英国消费者，你也可以向信息专员办公室投诉或依据法定权利维权。',
          ]},
        ],
      },
    },
  },
  es: {
    questionLabel: 'PREGUNTA PARA LA FUNDADORA',
    backHome: 'Volver a Once & Ours',
    readAlso: 'Relacionado',
    links: {terms: 'Términos del servicio', privacy: 'Aviso de privacidad', refunds: 'Reembolsos y cancelación'},
    checkoutConsentLabel: 'Pido que Once & Ours comience a suministrar el contenido digital de inmediato, y reconozco que, una vez iniciado el suministro, pierdo mi derecho de desistimiento de 14 días sobre esta compra.',
    pricingLegalLine: 'Las suscripciones se renuevan automáticamente y puedes cancelar cuando quieras. Consulta nuestros términos, el aviso de privacidad y los reembolsos y cancelación.',
    pages: {
      terms: {
        title: 'Términos del servicio',
        updated: 'Última actualización: 22 de noviembre de 2026',
        intro: 'Estos términos establecen las reglas básicas de uso de Once & Ours, una aplicación de narrativa personal operada por HOPPERLACE LTD.',
        sections: [
          {heading: 'Quiénes somos y qué hace el servicio', paragraphs: [
            'Once & Ours es una aplicación de narrativa personal. Compartes un recuerdo escribiendo, dictando o conversando en una entrevista hablada en directo, y el servicio te ayuda a convertirlo en un recuerdo ilustrado —un periódico, un cuadernillo o una carta— que puedes leer, editar, descargar, imprimir y compartir con quienes tú elijas. El servicio ofrece entrevistas asistidas por IA, traducción entre inglés, chino simplificado y español, ilustraciones generadas por IA y, opcionalmente, una búsqueda de contexto histórico público relacionado con lo que has contado.',
            'El servicio es operado por HOPPERLACE LTD, con número de compañía 16532585 y domicilio registrado en 71-75 Shelton Street, Covent Garden, London WC2H 9JQ ("nosotros"). El servicio está disponible en https://www.onceandours.com. Escríbenos a yuyu@hopperlace.ai.',
          ]},
          {heading: 'Cuentas', paragraphs: [
            'Para guardar tus historias en tu cuenta, inicia sesión con un código por correo electrónico o con una cuenta de Google. Eres responsable de cuidar el acceso a tu correo electrónico, de las palabras y fotografías que subes y de usar el servicio conforme a la ley. El trabajo de invitado permanece en tu navegador hasta que inicies sesión.',
          ]},
          {heading: 'Uso aceptable', paragraphs: [
            'Aceptas no usar el servicio para crear contenido ilegal, dañino o que vulnere derechos ajenos; no subir fotografías de personas que no hubieran consentido razonablemente; no intentar acceder a datos de otras personas, sobrecargar el servicio ni hacer ingeniería inversa más allá de lo que la ley permite; y no usar el servicio para generar contenido que haga pasar un relato por el testimonio auténtico de una persona real con el fin de engañar al lector. Podemos suspender cuentas que incumplan gravemente estas reglas; incluso en ese caso, conservas el acceso a las palabras y fotografías que guardaste.',
          ]},
          {heading: 'Tus historias y el contenido generado por IA', paragraphs: [
            'Las palabras y fotografías que aportas te pertenecen. Las ilustraciones generadas por IA se etiquetan siempre como ilustración. Los resultados de la IA se generan automáticamente y pueden ser inexactos, incompletos o no ser de tu agrado: revisa cada recuerdo antes de compartirlo, y las ilustraciones y traducciones de IA editadas siguen sujetas a esos mismos límites. Solo nos concedes el permiso limitado necesario para almacenar, procesar y mostrar tu contenido a fin de prestarte el servicio (por ejemplo, pasar tus palabras grabadas a un proveedor de IA para transcribirlas, o tu fotografía para generar la ilustración que pediste). No usamos el contenido privado de tus historias para publicitar ante otras personas.',
            'Las ilustraciones generadas por IA se te conceden con una licencia libre de regalías para usarlas en los recuerdos que crees: imprímelas, compártelas y consérvalas sin pagos adicionales. No reivindicamos la propiedad de las ilustraciones generadas por IA y no garantizamos que sean únicas ni que estén protegidas por derechos de autor.',
          ]},
          {heading: 'Historias gratuitas, suscripciones y límite mensual de uso razonable', paragraphs: [
            'Puedes probar el servicio gratis: 3 historias gratuitas antes de necesitar un plan de pago para seguir creando. Los planes de pago son una suscripción mensual o anual, con precio en dólares estadounidense según se muestre al pagar.',
            'Una suscripción cubre hasta 50 historias que inicies en cada mes calendario (medido en UTC). Este límite de uso razonable mantiene el servicio rápido y asequible para todos; la capacidad no usada no se acumula. Todo lo que ya hayas creado sigue siendo tuyo para leer, imprimir y compartir, sea cual sea tu plan.',
          ]},
          {heading: 'Paquetes de créditos', paragraphs: [
            'Los paquetes de créditos son compras únicas de 30 o 100 créditos de historia adicionales. Los créditos nunca caducan y conviven con la asignación de tu plan, así que sirven para un mes ajetreado o para perdurar más que la propia suscripción.',
          ]},
          {heading: 'Renovación y cancelación de suscripciones', paragraphs: [
            'Las suscripciones se renuevan automáticamente al final de cada período de facturación —los planes mensuales cada mes, los anuales cada año— hasta que canceles. Puedes cancelar en cualquier momento de forma autónoma mediante el enlace «Gestionar facturación» (el portal de cliente de Stripe) dentro de la aplicación. Cancelar detiene las próximas renovaciones; mantienes el acceso completo hasta el final del período ya pagado y no se te vuelve a cobrar después. Los paquetes de créditos comprados no se ven afectados.',
          ]},
          {heading: 'Tu derecho de desistimiento y la excepción de inicio inmediato', paragraphs: [
            'Si compras como consumidor en el Reino Unido, la legislación de consumo te da 14 días desde la compra para desistir de la mayoría de las compras y obtener un reembolso completo —también del contenido digital—, siempre que no hayas acordado que el suministro comience de inmediato.',
            'Como Once & Ours es contenido digital que empieza a funcionar en el momento del pago, al pagar te pedimos tu consentimiento expreso para comenzar el suministro de inmediato. Si das ese consentimiento y el suministro comienza, reconoces que se pierde el derecho de desistimiento de 14 días para esa compra, tal como permite el Reglamento de Contratos de Consumo (Información, Desistimiento y Cargos Adicionales) de 2013. La casilla de consentimiento se muestra justo antes del pago —el mismo texto aparece en nuestra página de reembolsos y cancelación—. Si no das el consentimiento, conservas el derecho de 14 días y el suministro comienza solo al expirar.',
          ]},
          {heading: 'Exenciones de responsabilidad', paragraphs: [
            'Prestamos el servicio con la diligencia y profesionalidad razonables. Las funciones de IA son automáticas y pueden equivocarse; el servicio no es un archivo profesional ni un servicio genealógico, jurídico o médico, y los recuerdos no deben utilizarse como registros autoritativos. Nada en estos términos limita la responsabilidad por muerte o lesiones causadas por negligencia, por fraude ni por aquello que la ley no permita limitar. Por lo demás, nuestra responsabilidad total por el servicio queda limitada al importe que nos hayas pagado en los 12 meses anteriores a la reclamación.',
          ]},
          {heading: 'Cambios, ley aplicable y contacto', paragraphs: [
            'Estos términos pueden cambiar; los cambios importantes se anunciarán en la aplicación. Estos términos se rigen por las leyes de Inglaterra y Gales, y los derechos de consumo del Reino Unido que te otorga la ley no quedan afectados por nada de lo aquí escrito. Preguntas, quejas y solicitudes de reembolso: yuyu@hopperlace.ai.',
          ]},
        ],
      },
      privacy: {
        title: 'Aviso de privacidad',
        updated: 'Última actualización: 22 de noviembre de 2026',
        intro: 'Este aviso explica qué recoge Once & Ours, dónde se guarda, quién nos ayuda a tratarlo y qué derechos tienes conforme al RGPD del Reino Unido. Once & Ours es operado por HOPPERLACE LTD (número de compañía 16532585, 71-75 Shelton Street, Covent Garden, London WC2H 9JQ). Contacto: yuyu@hopperlace.ai.',
        sections: [
          {heading: 'Qué recogemos', paragraphs: [
            'Los datos de tu cuenta: la dirección de correo con la que inicias sesión (por código o con Google) y los identificadores que devuelve tu proveedor de inicio de sesión.',
            'Tus historias: las palabras de la entrevista, el texto editado de tu recuerdo, sus traducciones y tus elecciones de ilustración —guardadas como datos privados de historia en tu cuenta.',
            'Las fotografías: si añades una, tu foto se guarda dentro de esos datos privados de historia. No se coloca en un área de almacenamiento público separada.',
            'Las grabaciones de voz: cuando grabas o dictas una respuesta, el audio se procesa para convertirlo en texto. La grabación original se queda en tu propio dispositivo, en tu navegador, y el audio en bruto nunca se sube a nuestra base de datos. Solo se guardan con tu historia las palabras transcritas.',
            'Registros de facturación y uso: tu plan, el número de historias creadas y los créditos de paquete restantes, y unos contadores mínimos de uso de IA que aplican los límites diarios y mensuales —se conservan para que el estado de pago sea exacto y honesto, no para perfilarte—.',
          ]},
          {heading: 'Dónde viven tus datos', paragraphs: [
            'Los datos de historias y de cuenta se guardan en Supabase (Postgres alojado), vinculados a tu cuenta. Privado significa privado: tus historias solo las lees tú, salvo cuando creas deliberadamente un enlace para compartir —esos enlaces no están enumerados y son revocables, y el uso compartido no ofrece búsqueda pública—. No vendemos tus datos y no hay publicidad.',
          ]},
          {heading: 'Cómo se usa la IA y quién nos ayuda', paragraphs: [
            'Las funciones de IA —entrevistar, transcribir grabaciones, traducir, interpretar fotografías, planificar la investigación, ayudar a redactar e ilustrar— envían solo el material necesario para cada paso a nuestros proveedores de IA. Google (Gemini, vía Google Cloud Vertex AI o AI Studio) gestiona la mayoría de las tareas; para las historias contadas en chino, la generación de texto puede dirigirse a Qwen a través de OpenRouter; la investigación histórica opcional usa Nimble para encontrar fuentes públicas en la web. Las fotografías solo se envían para su interpretación cuando eliges usar esa función. Las ilustraciones son generadas por IA y siempre se etiquetan como ilustración.',
            'Nimble es un tercero encargado del tratamiento que realiza este paso de investigación histórica siguiendo nuestras instrucciones; es el proveedor de descubrimiento en uso actualmente.',
          ]},
          {heading: 'Pagos y envío de correos', paragraphs: [
            'Los pagos y las suscripciones los gestiona Stripe. Los datos de tu tarjeta van a Stripe, no a nosotros —solo guardamos el estado de tu plan y los identificadores que Stripe necesita para reconocer tu suscripción—. Los códigos de inicio de sesión se envían por correo mediante Supabase Auth usando Resend como servicio de envío.',
          ]},
          {heading: 'Conservación y eliminación', paragraphs: [
            'Tus historias y fotografías se conservan hasta que tú o la ley nos pidamos eliminarlas. Al borrar una historia en Mis historias se eliminan ella y su fotografía. Eliminar tu cuenta borra tus historias, tus fotografías y los datos de tu cuenta.',
            'Aún no existe un flujo de eliminación de cuenta en la aplicación. Hasta que esté disponible, puedes solicitar la eliminación de tu cuenta y sus datos escribiendo a yuyu@hopperlace.ai; completaremos la eliminación en un plazo de 30 días desde tu solicitud. Este proceso por correo es provisional y se sustituirá cuando exista la eliminación dentro de la aplicación.',
          ]},
          {heading: 'Tus derechos conforme al RGPD del Reino Unido', paragraphs: [
            'Tienes derecho a saber cómo se usan tus datos (este aviso); a obtener una copia; a que se corrijan los datos inexactos; a que se supriman; a oponerte o limitar ciertos tratamientos; a portar tus datos a otro servicio cuando la ley lo permita; y a reclamar ante la Information Commissioner\u2019s Office (ico.org.uk). Para ejercer cualquier derecho, o con cualquier pregunta sobre tus datos, escribe a yuyu@hopperlace.ai.',
          ]},
        ],
      },
      refunds: {
        title: 'Reembolsos y cancelación',
        updated: 'Última actualización: 22 de noviembre de 2026',
        intro: 'Esta página explica cómo cancelar una suscripción, qué ocurre con los paquetes de créditos y cuándo se conceden reembolsos. Once & Ours es operado por HOPPERLACE LTD (número de compañía 16532585, 71-75 Shelton Street, Covent Garden, London WC2H 9JQ). Contacto: yuyu@hopperlace.ai.',
        sections: [
          {heading: 'Cancelar una suscripción', paragraphs: [
            'Puedes cancelar en cualquier momento de forma autónoma mediante el enlace «Gestionar facturación» de la aplicación —abre el portal de cliente de Stripe, donde se gestionan suscripciones y facturas—. No necesitas escribirnos para cancelar ni cobramos gastos de cancelación.',
            'La cancelación surte efecto al final del período de facturación en curso. Si por cualquier motivo no puedes usar el enlace «Gestionar facturación», escribe a yuyu@hopperlace.ai y gestionaremos la cancelación o cualquier cambio de facturación por ti.',
          ]},
          {heading: 'Qué hace la cancelación', paragraphs: [
            'Cancelar detiene la próxima renovación. Mantienes acceso completo a las funciones de tu plan hasta el final del período ya pagado; después, tu cuenta continúa en el plan gratuito y todo lo que has creado sigue siendo tuyo para leer, imprimir y compartir. Los paquetes de créditos comprados son tuyos con independencia del plan.',
          ]},
          {heading: 'Los paquetes de créditos nunca caducan', paragraphs: [
            'Los créditos de paquete son compras únicas y nunca caducan: úsalos ahora o dentro de años. No son suscripciones, así que no hay nada que cancelar.',
          ]},
          {heading: 'El derecho de 14 días y la excepción de inicio inmediato', paragraphs: [
            'Como consumidor del Reino Unido, normalmente tienes 14 días desde la compra para desistir y obtener un reembolso completo. Once & Ours es contenido digital que empieza a funcionar al pagar, así que al pagar te pedimos tu consentimiento expreso para comenzar el suministro de inmediato. Si das ese consentimiento, el derecho de 14 días no se aplica a esa compra una vez iniciado el suministro, tal como permite el Reglamento de Contratos de Consumo (Información, Desistimiento y Cargos Adicionales) de 2013. La casilla del pago lo dice en palabras claras antes de pagar.',
          ]},
          {heading: 'Reembolsos por cortesía', paragraphs: [
            'Aun fuera del plazo legal, si algo salió mal —un doble cobro, un crédito de historia que no llegó, o compraste por error y apenas has usado el servicio— escribe a yuyu@hopperlace.ai. Los reembolsos por cortesía se conceden a discreción de la fundadora; preferimos perder una tarifa antes que dejarte con una pérdida injusta.',
          ]},
          {heading: 'Cómo se pagan los reembolsos', paragraphs: [
            'Los reembolsos aprobados vuelven a tu método de pago original a través de Stripe. Si no estás conforme con el resultado de una solicitud de reembolso, puedes quejarte en yuyu@hopperlace.ai y, como consumidor del Reino Unido, ante la Information Commissioner\u2019s Office o ejercer tus derechos legales.',
          ]},
        ],
      },
    },
  },
};
