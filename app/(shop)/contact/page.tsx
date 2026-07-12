export default function ContactPage() {
  return (
    <main className="page-shell">
      <section className="page-card">
        <h1>Liên Hệ</h1>
        <form className="contact-form">
          <label>
            Tên của bạn
            <input name="name" placeholder="Cúc Họa Mi" />
          </label>
          <label>
            Email
            <input name="email" placeholder="email@example.com" />
          </label>
          <label>
            Tin nhắn
            <textarea name="message" placeholder="Bạn cần hỗ trợ gì nè?" />
          </label>
          <button type="submit" className="soft-button">Gửi tin nhắn</button>
        </form>
      </section>
    </main>
  );
}
