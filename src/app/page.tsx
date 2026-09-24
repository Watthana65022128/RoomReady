import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PLANS } from "@/lib/plans";
import "./landing.css";
import { BrandLogo } from "@/components/brand-logo";
export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "RoomReady · งานหอเบาลง เวลาชีวิตมากขึ้น",
  description:
    "จัดการห้อง ผู้เช่า มิเตอร์ ออกบิลและติดตามยอดชำระในที่เดียว ทดลองฟรี 30 วัน แพ็กเกจเริ่มต้น 99 บาท/เดือน สำหรับ 1 หอพัก ไม่เกิน 200 ห้อง",
  robots: { index: true, follow: true },
};
const features = [
  [
    "1",
    "ห้องและผู้เช่า",
    "รู้ว่าห้องไหนว่าง ใครพักอยู่",
    "รวมข้อมูลห้อง อัตราค่าเช่า และประวัติการเข้าพัก ไม่ต้องไล่เปิดสมุดหลายเล่ม",
  ],
  [
    "2",
    "มิเตอร์และค่าใช้จ่าย",
    "กรอกเลขมิเตอร์ แล้วไปต่อได้เลย",
    "บันทึกค่าน้ำค่าไฟทั้งหอ ตั้งอัตราเริ่มต้นและค่าใช้จ่ายเพิ่มเติม เพื่อใช้ต่อทุกรอบเดือน",
  ],
  [
    "3",
    "บิลและการรับชำระ",
    "ส่งบิลง่าย ตามยอดได้ครบ",
    "ตรวจบิลร่างก่อนออกจริง แชร์ลิงก์บิลให้ผู้เช่า รับสลิปและยืนยันการชำระในระบบ",
  ],
];
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ property?: string; tab?: string; month?: string; step?: string; status?: string; q?: string }>;
}) {
  const params = await searchParams;
  // Keep previously shared workspace bookmarks useful.
  if (params.property || params.tab || params.month || params.step || params.status || params.q) {
    const query = new URLSearchParams();
    for (const key of ["property", "tab", "month", "step", "status", "q"] as const)
      if (params[key]) query.set(key, params[key]);
    redirect("/dashboard?" + query.toString());
  }
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  const start = user ? "/dashboard" : "/signup";
  return (
    <div className="landing">
      <a className="landing-skip" href="#main">
        ข้ามไปเนื้อหา
      </a>
      <header className="landing-header">
        <Link className="brand" href="/">
          <BrandLogo />
        </Link>
        <nav aria-label="เมนูหลัก">
          <a href="#features">ฟีเจอร์</a>
          <a href="#pricing">ราคา</a>
          <a href="#faq">คำถามที่พบบ่อย</a>
        </nav>
        <div className="landing-account">
          {user ? (
            <Link className="landing-button dark" href="/dashboard">
              ไปหน้าจัดการ ↗
            </Link>
          ) : (
            <>
              <Link href="/login">เข้าสู่ระบบ</Link>
              <Link className="landing-button dark" href="/signup">
                สมัครสมาชิก ↗
              </Link>
            </>
          )}
        </div>
      </header>
      <main id="main">
        <section className="landing-hero landing-container">
          <div className="hero-copy">
            <div className="landing-kicker">
              <span /> ผู้ช่วยประจำหอของคุณ
            </div>
            <h1>
              งานหอเบาลง
              <br />
              เวลาชีวิต<span className="hero-highlight">มากขึ้น</span>
            </h1>
            <p>
              ตั้งแต่จดมิเตอร์จนถึงรับค่าเช่า
              <br className="desktop-break" /> จัดการทุกห้องในที่เดียว
              ไม่ต้องวนกับงานเดิมทุกสิ้นเดือน
            </p>
            <div className="landing-actions">
              <Link href={start} className="landing-button dark">
                {user ? "ไปหน้าจัดการ" : "ทดลองฟรี 30 วัน"} <span>↗</span>
              </Link>
              <a className="landing-text-link" href="#features">
                ดูว่าช่วยอะไรได้บ้าง ↓
              </a>
            </div>
            <p className="hero-fineprint">
              ไม่ต้องผูกบัตร · ทดลองได้ 30 ห้อง · เริ่มต้นเพียง 99 บาท/เดือน
            </p>
            <div className="hero-note">
              <span className="note-line" />
              <span>
                คุณดูแลคนในหอ
                <br />
                <strong>ให้ RoomReady ช่วยดูแลงานหลังบ้าน</strong>
              </span>
            </div>
          </div>
          <div
            className="hero-visual"
            aria-label="ภาพตัวอย่างหน้าจอจัดการหอพัก"
          >
            <div className="visual-top">
              <span>หนึ่งหอ ทุกห้อง อยู่ในมือคุณ</span>
              <span>↗</span>
            </div>
            <div className="sample-window">
              <div className="sample-top">
                <span className="sample-logo">R</span>
                <strong>หอพักบ้านสบาย</strong>
                <span className="sample-tag">ข้อมูลตัวอย่าง</span>
              </div>
              <div className="sample-heading">
                <div>
                  <small>ภาพรวมประจำเดือน</small>
                  <h2>จัดการวันนี้ ให้เดือนหน้าเบาขึ้น</h2>
                </div>
                <span>◫</span>
              </div>
              <div className="sample-stats">
                <div>
                  <span>รับชำระแล้ว</span>
                  <strong>฿72,000</strong>
                  <small>18 บิลที่ยืนยันรับเงิน</small>
                </div>
                <div>
                  <span>ห้องที่มีผู้เช่า</span>
                  <strong>
                    24 <small>/ 30</small>
                  </strong>
                  <small>ว่างอีก 6 ห้อง</small>
                </div>
              </div>
              <div className="sample-list-head">
                <strong>สถานะห้องพัก</strong>
                <span>ดูทั้งหมด →</span>
              </div>
              <div className="sample-rooms">
                {["101", "102", "103", "104", "105", "106"].map((room, i) => (
                  <div
                    key={room}
                    className={i === 4 ? "sample-room vacant" : "sample-room"}
                  >
                    <strong>{room}</strong>
                    <span>
                      {i === 4
                        ? "ห้องว่าง"
                        : i === 2
                          ? "รอตรวจสลิป"
                          : "ชำระแล้ว"}
                    </span>
                    <i className={i === 2 ? "waiting" : ""}>
                      {i === 4 ? "+" : i === 2 ? "◷" : "✓"}
                    </i>
                  </div>
                ))}
              </div>
              <div className="sample-bottom">
                <span>✓ บิล ค่าเช่า และยอดรับชำระ อยู่ที่เดียวกัน</span>
              </div>
            </div>
            <div className="visual-receipt">
              <span className="receipt-icon">✓</span>
              <div>
                <strong>จบงานสิ้นเดือนอย่างเป็นระบบ</strong>
                <span>กรอกมิเตอร์ → ตรวจบิล → ส่งให้ผู้เช่า</span>
              </div>
            </div>
            <span className="visual-caption">
              ภาพประกอบการใช้งาน · ไม่ใช่ข้อมูลลูกค้าจริง
            </span>
          </div>
        </section>
        <div className="landing-strip">
          <div className="landing-container">
            <span>ออกแบบมาสำหรับเจ้าของหอพัก</span>
            <strong>1 หอพักต่อบัญชี</strong>
            <span className="strip-dot">✳</span>
            <strong>ตั้งแต่ 1 ถึง 200 ห้อง</strong>
            <span className="strip-dot">✳</span>
            <strong>ใช้ได้ทั้งมือถือและคอมพิวเตอร์</strong>
          </div>
        </div>
        <section className="landing-container landing-section problem-section">
          <div>
            <span className="section-index">
              1 / งานเดิมที่ไม่ควรกินเวลาคุณ
            </span>
            <h2>
              สิ้นเดือนไม่จำเป็น
              <br />
              ต้องเริ่มนับหนึ่งใหม่
            </h2>
          </div>
          <div className="problem-list">
            {[
              [
                "ข้อมูลอยู่คนละที่",
                "ห้อง ผู้เช่า และอัตราค่าเช่า รวมไว้ให้หาเจอในที่เดียว",
              ],
              [
                "คิดบิลซ้ำทุกเดือน",
                "ตั้งค่าใช้จ่ายครั้งเดียว กรอกมิเตอร์และตรวจบิลก่อนออกจริง",
              ],
              [
                "ตามสลิปจนหลงแชต",
                "ผู้เช่าส่งสลิปผ่านลิงก์บิล เจ้าของตรวจและยืนยันการรับเงินได้",
              ],
            ].map(([problem, solution]) => (
              <article key={problem}>
                <span className="problem-arrow">↗</span>
                <div>
                  <h3>{problem}</h3>
                  <p>{solution}</p>
                </div>
              </article>
            ))}
          </div>
        </section>
        <section id="features" className="feature-section">
          <div className="landing-container landing-section">
            <div className="section-heading">
              <div>
                <span className="section-index">
                  2 / เครื่องมือที่ได้ใช้จริง
                </span>
                <h2>
                  ครบงานหอ
                  <br />
                  ในพื้นที่เดียว
                </h2>
              </div>
              <p>
                งานหลังบ้านที่ต่อกันเป็นขั้นตอน
                <br />
                คุณจึงมีเวลาให้เรื่องอื่นได้มากขึ้น
              </p>
            </div>
            <div className="feature-grid">
              {features.map(([n, tag, title, body]) => (
                <article key={n}>
                  <div className="feature-top">
                    <span>{tag}</span>
                    <b>{n}</b>
                  </div>
                  <h3>{title}</h3>
                  <p>{body}</p>
                </article>
              ))}
            </div>
            <div className="getting-started">
              <span className="section-index">เริ่มต้นง่าย ๆ</span>
              <div>
                <b>1</b>
                <span>
                  สมัครสมาชิก
                  <br />
                  <small>รับสิทธิ์ทดลอง 30 วัน</small>
                </span>
              </div>
              <div>
                <b>2</b>
                <span>
                  ตั้งค่าหอและห้องพัก
                  <br />
                  <small>ใส่อัตราค่าเช่าและค่าน้ำไฟ</small>
                </span>
              </div>
              <div>
                <b>3</b>
                <span>
                  เริ่มรอบบิลแรก
                  <br />
                  <small>กรอกมิเตอร์ ตรวจ แล้วแชร์บิล</small>
                </span>
              </div>
            </div>
          </div>
        </section>
        <section id="pricing" className="landing-container landing-section">
          <div className="section-heading">
            <div>
              <span className="section-index">
                3 / ราคาเรียบง่าย โตไปกับหอคุณ
              </span>
              <h2>
                เลือกตามจำนวนห้อง
                <br />
                ได้ฟีเจอร์ครบเหมือนกัน
              </h2>
            </div>
            <p>
              ทุกแพ็กเกจสำหรับ 1 หอพักต่อบัญชี
              <br />
              จ่ายเป็นรายเดือน ไม่มีการตัดเงินอัตโนมัติ
            </p>
          </div>
          <div className="trial-ribbon">
            <span>
              <strong>ลองให้เข้ากับงานของคุณก่อน</strong> ทดลองฟรี 30 วัน
              ไม่เกิน 30 ห้อง
            </span>
            <Link href={start}>
              {user ? "ไปหน้าจัดการ" : "เริ่มทดลองฟรี"} ↗
            </Link>
          </div>
          <div className="plan-grid">
            {Object.entries(PLANS).map(([id, p]) => (
              <article
                key={id}
                className={`plan-card ${id === "standard" ? "featured" : ""}`}
              >
                <div className="plan-heading">
                  <h3>{p.name}</h3>
                  <span>
                    {id === "starter"
                      ? "หอขนาดเล็ก"
                      : id === "standard"
                        ? "หอขนาดกลาง"
                        : "หอขนาดใหญ่"}
                  </span>
                </div>
                <p className="plan-price">
                  {p.price}
                  <small> บาท/เดือน</small>
                </p>
                <p className="plan-capacity">
                  ไม่เกิน <strong>{p.rooms} ห้อง</strong>
                </p>
                <Link
                  className={`landing-button ${id === "standard" ? "light" : "outlined"}`}
                  href={user ? "/subscription" : "/signup"}
                >
                  {user ? "จัดการแพ็กเกจ" : "เริ่มจากทดลองฟรี"} ↗
                </Link>
                <ul>
                  <li>1 หอพักต่อบัญชี</li>
                  <li>จัดการห้องและข้อมูลผู้เช่า</li>
                  <li>บันทึกมิเตอร์และออกบิล</li>
                  <li>แชร์บิล รับสลิป และติดตามยอด</li>
                </ul>
              </article>
            ))}
          </div>
          <p className="pricing-note">
            ช่วงทดลองใช้ได้สูงสุด 30 ห้อง
            หลังทดลองเลือกแพ็กเกจและให้แอดมินยืนยันหลังรับชำระเงิน
          </p>
        </section>
        <section
          id="faq"
          className="landing-container landing-section faq-section"
        >
          <div>
            <span className="section-index">4 / ก่อนเริ่มใช้งาน</span>
            <h2>
              เรื่องที่คุณ
              <br />
              อาจอยากรู้
            </h2>
          </div>
          <div className="faq-list">
            {[
              [
                "ทดลองฟรีได้อะไรบ้าง?",
                "ใช้ฟีเจอร์จัดการหอพักได้ 30 วันนับจากสมัคร สำหรับ 1 หอและไม่เกิน 30 ห้อง โดยไม่ต้องผูกบัตร",
              ],
              [
                "เจ้าของหนึ่งบัญชีมีหลายหอได้ไหม?",
                "บัญชีเจ้าของหนึ่งบัญชีสร้างได้หนึ่งหอพัก เลือกแพ็กเกจตามจำนวนห้อง โดยแพ็กเกจสูงสุดรองรับ 200 ห้อง",
              ],
              [
                "ครบ 30 วันแล้วข้อมูลจะหายไหม?",
                "ข้อมูลยังอยู่และเปิดดูได้ แต่จะบันทึกการเปลี่ยนแปลงไม่ได้จนกว่าแอดมินจะยืนยันสิทธิ์แพ็กเกจ",
              ],
              [
                "จะชำระเงินและเปิดแพ็กเกจอย่างไร?",
                "ส่งคำขอที่หน้าแพ็กเกจและสิทธิ์ใช้งาน แอดมินจะประสานการชำระเงินนอกระบบและยืนยันสิทธิ์ครั้งละ 1 เดือน ไม่มีการตัดเงินอัตโนมัติ",
              ],
              [
                "ห้องเพิ่มขึ้น เปลี่ยนแพ็กเกจได้ไหม?",
                "ขอเปลี่ยนแพ็กเกจได้จากบัญชีของคุณ โควตาใหม่เริ่มเมื่อแอดมินยืนยัน หากลดแพ็กเกจจนจำนวนห้องเกินโควตา ข้อมูลเดิมยังอยู่ แต่เพิ่มห้องไม่ได้",
              ],
            ].map(([q, a]) => (
              <details key={q}>
                <summary>
                  {q}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="landing-final">
          <div className="landing-container">
            <span className="section-index">งานหอพักที่เบาขึ้นทุกเดือน</span>
            <h2>
              ให้เดือนหน้า
              <br />
              เป็นเดือนที่จัดการง่ายกว่าเดิม
            </h2>
            <Link href={start} className="landing-button light">
              {user ? "ไปหน้าจัดการ" : "เริ่มทดลองฟรี 30 วัน"} ↗
            </Link>
            <p>1 หอพัก · ทดลองสูงสุด 30 ห้อง · ไม่ต้องผูกบัตร</p>
          </div>
        </section>
      </main>
    </div>
  );
}
