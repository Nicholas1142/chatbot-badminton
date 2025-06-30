import os
import json
from pathlib import Path

import openai
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from dotenv import load_dotenv

# —— 1. 加载环境变量 & OpenAI Key —— 
load_dotenv()
openai.api_key = os.getenv("OPENAI_API_KEY")
print(">>> OPENAI_API_KEY =", openai.api_key)  # 开发阶段可留，确认 Key 正确读取

app = FastAPI()

# —— 2. CORS：允许任意来源访问 —— 
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# —— 3. 载入本地球拍数据 —— 
BASE_DIR = Path(__file__).resolve().parent.parent  # 指项目根目录
DATA_PATH = BASE_DIR / "data" / "rackets.json"
with DATA_PATH.open(encoding="utf-8") as f:
    RACKETS = json.load(f)

# —— 4. 请求体模型 —— 
class UserAnswers(BaseModel):
    level: str
    style: str
    stiffness: str
    budget: int

# —— 5. 简单筛选逻辑 —— 
def recommend_rackets(ans: UserAnswers):
    filtered = [r for r in RACKETS if r["level"] == ans.level]
    filtered = [r for r in filtered if r["style"] == ans.style]
    filtered = [r for r in filtered if r["stiffness"] == ans.stiffness]
    affordable = [r for r in filtered if r["price"] <= ans.budget]
    return sorted(affordable, key=lambda x: x["price"])[:3]

# —— 6. 主路由：规则 + GPT 说明 —— 
@app.post("/recommend")
def recommend(ans: UserAnswers):
    # 6.1 先用规则筛选
    recs = recommend_rackets(ans)

    # 6.2 构造 GPT 提示
    prompt = f"""
你是羽毛球拍专家。根据用户需求和已筛选出的拍子列表，生成一段中文推荐说明，内容需包括：
1. 每支拍子的亮点与适用人群；
2. 为什么符合用户的需求（水平/打法/硬度/预算）；
3. 如有必要，给出保养或购买建议。

用户需求：
- 水平：{ans.level}
- 打法：{ans.style}
- 拍框硬度：{ans.stiffness}
- 预算上限：¥{ans.budget}

已筛选列表（JSON）：
{json.dumps(recs, ensure_ascii=False)}

请按序号分点描述，条理清晰，语气专业但通俗易懂。
"""
    # 6.3 调用 OpenAI 并做容错
    try:
        resp = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[{"role": "user", "content": prompt}],
            temperature=0.7,
        )
        explanation = resp.choices[0].message.content.strip()
    except Exception as e:
        errmsg = str(e).lower()
        # 如果是配额用完相关错误
        if "429" in errmsg or "quota" in errmsg:
            explanation = "⚠️ OpenAI 配额已用尽，请前往控制台查看并充值后重试。"
        else:
            print("OpenAI 调用出错：", e)
            explanation = "⚠️ 暂时无法生成推荐说明，请稍后再试。"

    # 6.4 返回给前端
    return {
        "recommendations": recs,
        "explanation": explanation
    }

# —— 7. 本地调试用 —— 
if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000, reload=True)
