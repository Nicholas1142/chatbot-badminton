import React, { useState, useEffect } from 'react';

const QUESTIONS = [
  { key: 'level',     text: '1️⃣ 你的水平是？（初学 / 进阶 / 专业）' },
  { key: 'style',     text: '2️⃣ 你偏好哪种打法？（进攻型 / 控制型 / 全能型）' },
  { key: 'stiffness', text: '3️⃣ 你喜欢拍框硬度？（软 / 中硬 / 硬）' },
  { key: 'budget',    text: '4️⃣ 你的预算大概是多少？（请输入数字，例如 500）' },
];

function App() {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState({});
  const [msgs, setMsgs] = useState([
    { from: 'bot', text: '欢迎使用羽毛球拍推荐 🤖，请回答以下问题~' }
  ]);
  const [recs, setRecs] = useState([]);

  const send = async (text) => {
    // 1. 显示用户回答
    setMsgs(m => [...m, { from: 'user', text }]);

    // 2. 记录回答到 newAnswers
    const q = QUESTIONS[step];
    const value = q.key === 'budget' ? Number(text) : text;
    const newAnswers = { ...answers, [q.key]: value };
    setAnswers(newAnswers);

    // 3. 如果还有问题，继续下一步
    if (step + 1 < QUESTIONS.length) {
      const nextStep = step + 1;
      setStep(nextStep);
      setMsgs(m => [...m, { from: 'bot', text: QUESTIONS[nextStep].text }]);
      return;
    }

    // 4. 最后一步，调用后端
    setMsgs(m => [...m, { from: 'bot', text: '正在为你推荐，请稍候…' }]);
    try {
      const resp = await fetch('http://localhost:8000/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newAnswers),
      });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);

      // 从后端同时拿到 recommendations 和 explanation
      const { recommendations, explanation } = await resp.json();

      if (recommendations.length === 0) {
        setMsgs(m => [...m, { from: 'bot', text: '抱歉，未找到符合条件的球拍。' }]);
      } else {
        setMsgs(m => [
          ...m,
          { from: 'bot', text: '为你找到了以下推荐：' },
          { from: 'bot', text: explanation },
        ]);
        setRecs(recommendations);
      }
    } catch (e) {
      setMsgs(m => [...m, { from: 'bot', text: '网络出错，请稍后重试。' }]);
    }
  };

  // 发送按钮或回车触发
  const handleSend = (e) => {
    e.preventDefault();
    const txt = e.target.elements.userInput.value.trim();
    if (!txt) return;
    e.target.elements.userInput.value = '';
    send(txt);
  };

  // 初次渲染，发第一个问题
  useEffect(() => {
    setMsgs(m => [...m, { from: 'bot', text: QUESTIONS[0].text }]);
  }, []);

  return (
    <div className="h-screen flex flex-col p-4">
      {/* 聊天记录 */}
      <div className="flex-1 overflow-auto space-y-2 mb-4">
        {msgs.map((m, i) => (
          <div key={i} className={m.from === 'user' ? 'text-right' : 'text-left'}>
            <span className="inline-block p-2 rounded bg-gray-200">{m.text}</span>
          </div>
        ))}
      </div>

      {/* 推荐卡片 */}
      {recs.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          {recs.map(r => (
            <div key={r.id} className="border rounded-lg p-4 shadow">
              <img src={r.img} alt={r.model} className="w-full h-40 object-cover rounded" />
              <h3 className="mt-2 font-bold">{r.brand} - {r.model}</h3>
              <p>水平：{r.level} | 打法：{r.style}</p>
              <p>硬度：{r.stiffness} | 价格：¥{r.price}</p>
            </div>
          ))}
        </div>
      )}

      {/* 输入框 */}
      <form onSubmit={handleSend} className="flex">
        <input
          name="userInput"
          className="flex-1 border rounded p-2"
          placeholder="在此输入你的回答，然后回车或点击发送"
        />
        <button className="ml-2 px-4 bg-blue-500 text-white rounded">发送</button>
      </form>
    </div>
  );
}

export default App;
