import { useState } from "react";
import {
  ArrowRight,
  BellRing,
  Check,
  ClipboardCheck,
  Clock3,
  CreditCard,
  House,
  LockKeyhole,
  Menu,
  MessageCircle,
  Moon,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  Sun,
  X,
} from "lucide-react";
import { LanguageSwitcher, useLocale } from "../i18n";
import { Logo } from "../components";
import { CareIllustration } from "../CareIllustration";
import { apiUrl } from "../lib/api";

export function PatientHomeIntro() {
  const { language } = useLocale();
  const [menuOpen, setMenuOpen] = useState(false);
  const copy = (zh: string, en: string) => (language === "zh-HK" ? zh : en);
  const cta = copy("立即查詢", "Enquire now");
  const links = [
    ["home", copy("首頁", "Home")],
    ["how-it-works", copy("流程", "Process")],
    ["pricing", copy("收費", "Pricing")],
    ["advantages", copy("我們的優勢", "Our advantages")],
    ["care-boundaries", copy("安心約定", "Our commitment")],
  ];
  const enquiry = (className = "ck-button") => (
    <a className={className} href="/#enquire">
      {cta}
      <ArrowRight size={18} aria-hidden="true" />
    </a>
  );
  const steps = [
    {
      icon: MessageCircle,
      title: copy("開始查詢", "Start an enquiry"),
      text: copy(
        "用文字或表格講低病人狀況、地區及希望時段，個人資料按查詢頁規則處理。",
        "Describe the patient’s situation, district and preferred times in words or through the form. Personal details follow the enquiry page’s existing rules.",
      ),
    },
    {
      icon: Sparkles,
      title: copy("文字／AI 整理", "Organise and review"),
      text: copy(
        "系統幫你整理服務項目同偏好；報價前，你再核對一次。",
        "The system organises your requested services and preferences. Review the details before a quotation is prepared.",
      ),
    },
    {
      icon: CreditCard,
      title: copy("確認報價同付款", "Confirm the quote and pay"),
      text: copy(
        "同意報價後，按指示完成付款。服務參考價列於下方收費區。",
        "Accept the quotation and follow the payment instructions. Reference prices are listed below.",
      ),
    },
    {
      icon: Stethoscope,
      title: copy("先付款，再派單", "Payment, then dispatch"),
      text: copy(
        "款項核實後，向合資格護士派單，以先到先得方式接單。",
        "Once payment is verified, the case is offered to qualified nurses on a first-come, first-served basis.",
      ),
    },
    {
      icon: LockKeyhole,
      title: copy("私人確認資料", "Confirm details privately"),
      text: copy(
        "單位等敏感資料經安全途徑補齊；日程覆核後先交予接單護士。",
        "Provide unit details privately through a secure channel. Details are released to the assigned nurse after schedule review.",
      ),
    },
  ];
  const advantages = [
    {
      icon: Sparkles,
      title: copy("即時免費報價", "Instant, free quotation"),
      text: copy(
        "填妥護理需求後即時獲得免費報價，毋須等候人工客服回覆。",
        "Receive a free quotation as soon as you complete your care requirements, without waiting for a customer-service reply.",
      ),
    },
    {
      icon: ShieldCheck,
      title: copy("資深護理團隊把關", "Senior nursing review"),
      text: copy(
        "由資深護理團隊核對需要，制定個人化照護計劃時間表（Care Schedule）。",
        "A senior nursing team reviews your needs and develops a personalised Care Schedule.",
      ),
    },
    {
      icon: ClipboardCheck,
      title: copy("按計劃執行，不遺漏", "Every care task accounted for"),
      text: copy(
        "護士嚴格按照計劃上門執行，確保每一項護理環節均不遺漏。",
        "Nurses follow the agreed plan during home visits, ensuring every care task is accounted for.",
      ),
    },
    {
      icon: BellRing,
      title: copy("智能提醒，準時跟進", "Smart, timely reminders"),
      text: copy(
        "智能提醒功能確保每個服務環節準時跟進，家人與護理人員清楚掌握到訪時間及工作項目。",
        "Smart reminders keep each stage on track, so families and care providers know the visit time and planned tasks.",
      ),
    },
  ];

  return (
    <div className="ck-home" id="home">
      <div className="ck-topbar">
        <div className="ck-container">
          <span>
            {copy("用心關懷，就在你家。", "Thoughtful care, right at home.")}
          </span>
          <LanguageSwitcher />
        </div>
      </div>
      <header className="ck-header">
        <div className="ck-container ck-header-inner">
          <a className="ck-brand" href="#home" aria-label="CareKnock · 護臨">
            <Logo />
            <span className="ck-brand-zh">· 護臨</span>
          </a>
          <nav
            id="ck-navigation"
            className={menuOpen ? "ck-nav is-open" : "ck-nav"}
            aria-label={copy("主頁導覽", "Homepage navigation")}
          >
            {links.map(([id, label]) => (
              <a key={id} href={`#${id}`} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="ck-header-actions">
            {enquiry("ck-button ck-button-small")}
            <button
              className="ck-menu"
              type="button"
              aria-label={copy("主頁選單", "Homepage menu")}
              aria-expanded={menuOpen}
              aria-controls="ck-navigation"
              onClick={() => setMenuOpen(!menuOpen)}
            >
              {menuOpen ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
      <main>
        <section className="ck-hero" aria-labelledby="ck-hero-title">
          <div className="ck-container ck-hero-grid">
            <div className="ck-hero-copy">
              <p className="ck-eyebrow">
                {copy(
                  "香港上門護理導航 · CareKnock 護臨",
                  "HONG KONG HOME NURSING · CAREKNOCK",
                )}
              </p>
              <h1 id="ck-hero-title">
                {copy("在家多一點支援，", "A little help at home.")}
                <br />
                <span>
                  {copy("生活多一份安心。", "A lot of peace of mind.")}
                </span>
              </h1>
              <p className="ck-hero-sub">
                {copy(
                  "用文字講低護理需要，我哋整理項目、即時報價，再由資深護理團隊把關，安排合資格護士上門。",
                  "Tell us what care you need. We organise the details and provide an instant quotation, with senior nursing review before arranging a qualified nurse’s home visit.",
                )}
              </p>
              <div className="ck-pills">
                {[
                  copy("上門護理", "Home nursing"),
                  copy("即時報價", "Instant quotation"),
                  copy("專業核對", "Professional review"),
                ].map((label) => (
                  <span key={label}>
                    <Check size={14} aria-hidden="true" />
                    {label}
                  </span>
                ))}
              </div>
              <p className="ck-hero-hook">
                {copy(
                  "填妥需求即時免費報價；資深護理團隊核對後制定照護計劃時間表。",
                  "Complete your requirements for a free instant quotation; the senior nursing team then reviews your needs and prepares a Care Schedule.",
                )}
              </p>
              {enquiry()}
              <p className="ck-micro">
                {copy(
                  "免費查詢，唔承諾落單；急症請致電 999。",
                  "A free enquiry carries no booking commitment. For emergencies, call 999.",
                )}
              </p>
            </div>
            <div className="ck-hero-visual">
              <div className="ck-visual-heading">
                <House size={20} aria-hidden="true" />
                <span>
                  {copy(
                    "專業照顧，走近你的日常",
                    "Professional care, closer to home",
                  )}
                </span>
              </div>
              <div
                className="ck-illustration"
                role="img"
                aria-label={copy(
                  "護士在家居環境支援長者的插畫",
                  "Illustration of a nurse supporting an older person at home",
                )}
              >
                <CareIllustration />
              </div>
              <div className="ck-quote-card">
                <span className="ck-icon">
                  <Sparkles size={22} aria-hidden="true" />
                </span>
                <div>
                  <strong>
                    {copy("即時免費報價", "Instant, free quotation")}
                  </strong>
                  <span>
                    {copy(
                      "先了解安排，再決定下一步",
                      "Understand the options before your next step",
                    )}
                  </span>
                </div>
                <Check size={19} aria-hidden="true" />
              </div>
              <p className="ck-visual-caption">
                CareKnock · 護臨{" "}
                <span>
                  {copy(
                    "由需要開始，讓照顧有序",
                    "Care starts with your needs",
                  )}
                </span>
              </p>
            </div>
          </div>
        </section>

        <section
          className="ck-section ck-process"
          id="how-it-works"
          aria-labelledby="ck-process-title"
        >
          <div className="ck-container">
            <div className="ck-section-heading">
              <p className="ck-eyebrow">
                01 / {copy("服務流程", "THE PROCESS")}
              </p>
              <h2 id="ck-process-title">
                {copy(
                  "由查詢到上門，五步搞掂",
                  "From enquiry to your door, in five steps",
                )}
              </h2>
              <p>
                {copy(
                  "整條流程寫低，你跟住做就得；改期、轉帳核對等細節，提交查詢後由同事用電郵跟進。",
                  "A clear process from the start. After your enquiry, our team follows up by email on details such as rescheduling and transfer verification.",
                )}
              </p>
            </div>
            <ol className="ck-steps">
              {steps.map((step, i) => (
                <li key={i}>
                  <div className="ck-step-top">
                    <step.icon size={24} strokeWidth={1.6} aria-hidden="true" />
                    <span>0{i + 1}</span>
                  </div>
                  <h3>{step.title}</h3>
                  <p>{step.text}</p>
                </li>
              ))}
            </ol>
            <div className="ck-section-action">
              {enquiry("ck-button ck-button-outline")}
            </div>
          </div>
        </section>

        <section
          className="ck-section ck-pricing"
          id="pricing"
          aria-labelledby="ck-pricing-title"
        >
          <div className="ck-container ck-pricing-grid">
            <div>
              <p className="ck-eyebrow">
                02 / {copy("服務同收費", "SERVICES & PRICING")}
              </p>
              <h2 id="ck-pricing-title">
                {copy("上門護理點計費", "Home nursing, clearly priced")}
              </h2>
              <p className="ck-lead">
                {copy(
                  "按確認咗嘅護理需要、專業要求同到訪時長計費。常見時段參考如下；實際報價以同事核實後為準，提交查詢唔代表一定要落單。",
                  "Pricing depends on confirmed care needs, professional requirements and visit duration. These are reference rates; the final quotation is subject to staff verification. An enquiry carries no booking commitment.",
                )}
              </p>
              <div className="ck-service-tags">
                <span>{copy("上門護理", "Home nursing")}</span>
                <span>{copy("陪診支援", "Appointment support")}</span>
                <span>{copy("日夜時段", "Day & night")}</span>
              </div>
              <p className="ck-pricing-note">
                {copy(
                  "最低服務時數、星期日／公眾假期附加及地區安排，查詢時確認；工具物料由客人自備。",
                  "Confirm minimum hours, Sunday/public-holiday supplements and district arrangements during your enquiry. Clients supply tools and materials.",
                )}
              </p>
            </div>
            <div className="ck-price-card">
              <div className="ck-package">
                <p>
                  <Sun size={19} aria-hidden="true" />
                  {copy("30 小時日間套餐", "30-hour daytime package")}
                </p>
                <div className="ck-price">
                  <span>HK$</span>
                  <strong>8,650</strong>
                </div>
                <span>
                  {copy(
                    "適合多次上門，一次掌握預算",
                    "Plan ahead for multiple home visits",
                  )}
                </span>
              </div>
              <dl className="ck-hourly">
                <div>
                  <dt>
                    <Sun size={19} aria-hidden="true" />
                    <span>
                      {copy("日間", "Daytime")}
                      <small>07:00–22:00</small>
                    </span>
                  </dt>
                  <dd>
                    HK$305<small>{copy("／小時", " / hour")}</small>
                  </dd>
                </div>
                <div>
                  <dt>
                    <Moon size={19} aria-hidden="true" />
                    <span>
                      {copy("夜間", "Nighttime")}
                      <small>
                        {copy("22:00–翌日 07:00", "22:00–07:00 next day")}
                      </small>
                    </span>
                  </dt>
                  <dd>
                    HK$325<small>{copy("／小時", " / hour")}</small>
                  </dd>
                </div>
              </dl>
              {enquiry()}
            </div>
          </div>
        </section>

        <section
          className="ck-section ck-advantages"
          id="advantages"
          aria-labelledby="ck-advantages-title"
        >
          <div className="ck-container">
            <div className="ck-section-heading">
              <p className="ck-eyebrow">
                03 / {copy("每一步，都有跟進", "SUPPORT AT EVERY STEP")}
              </p>
              <h2 id="ck-advantages-title">
                {copy("我們的優勢", "Our advantages")}
              </h2>
              <p>
                {copy(
                  "由即時報價到按計劃上門，讓家人與護理人員清楚掌握每一個環節。",
                  "From instant quotation to planned home visits, keep families and care providers informed at every stage.",
                )}
              </p>
            </div>
            <div className="ck-advantage-grid">
              {advantages.map(({ icon: Icon, title, text }) => (
                <article key={title}>
                  <span className="ck-icon">
                    <Icon size={26} strokeWidth={1.6} aria-hidden="true" />
                  </span>
                  <h3>{title}</h3>
                  <p>{text}</p>
                </article>
              ))}
            </div>
            <div className="ck-support-grid">
              <div>
                <House size={22} aria-hidden="true" />
                <h3>{copy("合資格護士上門照顧", "Qualified care at home")}</h3>
                <p>
                  {copy(
                    "提供到府護理及陪診等服務，於家居環境完成安排與協調。",
                    "Home nursing and appointment support, coordinated around everyday life at home.",
                  )}
                </p>
              </div>
              <div>
                <Clock3 size={22} aria-hidden="true" />
                <h3>
                  {copy("日夜時段，預算有選擇", "Flexible times and budgets")}
                </h3>
                <p>
                  {copy(
                    "日間 HK$305／小時、夜間 HK$325／小時；30 小時日間套餐 HK$8,650。",
                    "Daytime HK$305/hour, nighttime HK$325/hour; a 30-hour daytime package for HK$8,650.",
                  )}
                </p>
              </div>
              <div>
                <MessageCircle size={22} aria-hidden="true" />
                <h3>
                  {copy(
                    "文字與 AI 雙通道整理",
                    "Words or a form, with AI support",
                  )}
                </h3>
                <p>
                  {copy(
                    "可用文字描述或表單填寫；AI 協助整理項目與時段偏好，專業核對由護理人員負責。",
                    "Describe your needs or complete the form. AI helps organise services and timing; nursing professionals handle the professional review.",
                  )}
                </p>
              </div>
            </div>
            <div className="ck-section-action">
              {enquiry("ck-button ck-button-outline")}
            </div>
          </div>
        </section>

        <section
          className="ck-section ck-boundaries"
          id="care-boundaries"
          aria-labelledby="ck-boundaries-title"
        >
          <div className="ck-container ck-boundary-grid">
            <div>
              <p className="ck-eyebrow">
                04 / {copy("安心約定", "OUR COMMITMENT")}
              </p>
              <h2 id="ck-boundaries-title">
                {copy("AI 幫手整理，", "AI helps organise.")}
                <br />
                {copy("決定喺你。", "You decide.")}
              </h2>
              <ShieldCheck
                className="ck-boundary-symbol"
                size={86}
                strokeWidth={1}
                aria-hidden="true"
              />
            </div>
            <div className="ck-boundary-list">
              {[
                [
                  copy(
                    "整理資料，不做臨床判斷",
                    "Organisation, with clear clinical boundaries",
                  ),
                  copy(
                    "AI 只整理你提供嘅資料，包括服務項目、時段偏好等，唔會做臨床判斷，亦唔會取代護士專業評估。",
                    "AI only organises information you provide, including services and preferred times. It does not make clinical decisions or replace a nurse’s professional assessment.",
                  ),
                ],
                [
                  copy("報價同日程，由你確認", "Your approval comes first"),
                  copy(
                    "報價同到訪日程要你同意先至作實；你可以先查詢，再決定係唔係付款。",
                    "Quotations and visit schedules take effect only with your agreement. Enquire first, then decide whether to pay.",
                  ),
                ],
                [
                  copy(
                    "付款核實後，先到先得派單",
                    "Verified payment before dispatch",
                  ),
                  copy(
                    "先完成付款，再按先到先得派俾合資格護士；平台負責協調安排。急症請致電 999。",
                    "After payment, cases are offered to qualified nurses on a first-come, first-served basis. The platform coordinates arrangements. For emergencies, call 999.",
                  ),
                ],
              ].map(([title, text], i) => (
                <div key={title}>
                  <span>0{i + 1}</span>
                  <div>
                    <h3>{title}</h3>
                    <p>{text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="ck-final-cta" aria-labelledby="ck-cta-title">
          <div className="ck-container">
            <p className="ck-eyebrow">
              {copy("CareKnock · 護臨", "CAREKNOCK · 護臨")}
            </p>
            <h2 id="ck-cta-title">
              {copy("而家開始查詢上門支援", "Start your home-care enquiry")}
            </h2>
            <p>
              {copy(
                "講低邊位需要護理、大概地區同希望時段。同事會用電郵跟進、確認報價同安排。",
                "Tell us who needs care, the district and preferred times. Our team follows up by email to confirm the quotation and arrangements.",
              )}
            </p>
            {enquiry("ck-button ck-button-peach")}
            <p className="ck-emergency">
              {copy(
                "緊急情況請致電 999。CareKnock 網站無人即時監察急症。",
                "For emergencies, call 999. The CareKnock website is not monitored for urgent medical help.",
              )}
            </p>
          </div>
        </section>
      </main>
      <footer className="ck-footer">
        <div className="ck-container">
          <div className="ck-footer-main">
            <div>
              <a className="ck-brand" href="#home">
                <Logo />
                <span className="ck-brand-zh">· 護臨</span>
              </a>
              <p>
                {copy(
                  "香港上門護理導航及協調。",
                  "Home nursing navigation and coordination in Hong Kong.",
                )}
              </p>
            </div>
            <nav aria-label={copy("頁腳導覽", "Footer navigation")}>
              {links.map(([id, label]) => (
                <a key={id} href={`#${id}`}>
                  {label}
                </a>
              ))}
              <a href="/#enquire">{cta}</a>
            </nav>
          </div>
          <div className="ck-footer-bottom">
            <span>
              ©{" "}
              {new Intl.DateTimeFormat("en", {
                year: "numeric",
                timeZone: "Asia/Hong_Kong",
              }).format(new Date())}{" "}
              CareKnock · 護臨
            </span>
            <p>
              {copy(
                "本網站無人監察緊急求助。如在香港遇到緊急情況，請致電 999。",
                "This website is not monitored for emergency requests. For an immediate emergency in Hong Kong, call 999.",
              )}
            </p>
            <a href={apiUrl("/auth/google")}>
              {copy("職員登入", "Staff sign in")}
              <ArrowRight size={13} aria-hidden="true" />
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
