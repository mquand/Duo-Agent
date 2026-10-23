import { LLMProvider } from '../providers/base.js';
import { Plan } from '../types/index.js';

export class ArchitectAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async plan(prompt: string, codeSkeleton: string, projectRules?: string): Promise<Plan> {
    const systemPrompt = `Bạn là Lead System Architect hàng đầu, tuân thủ triệt để TRIẾT LÝ PONYTAIL:
"The best code is the code you never wrote" (Mã nguồn tốt nhất là mã không phải viết).

QUY TẮC PONYTAIL BẮT BUỘC:
1. YAGNI: Không over-engineer, không tạo class/module/wrapper/file mới nếu chỉ cần sửa 3-5 dòng vào hàm hiện có.
2. TÁI SỬ DỤNG: Tận dụng tối đa các hàm, helper, thư viện đã có trong dự án.
3. TỐI THIỂU HÓA: Chia nhỏ thành số lượng bước ít nhất có thể. Mỗi bước phải có mục tiêu độc lập.
4. SONG SONG HÓA (DAG): Khai báo rõ "depends_on" giữa các bước. Các bước độc lập (ví dụ sửa backend vs sửa frontend) phải có "depends_on": [] để hệ thống chạy song song.

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (Chỉ xuất JSON thuần, không bọc trong markdown):
{
  "goal": "Tóm tắt mục tiêu ngắn gọn",
  "summary": "Mô tả giải pháp kiến trúc trong 2-3 câu",
  "dag": [
    {
      "id": "step_1",
      "title": "Tên ngắn gọn của bước",
      "target_files": ["đường_dẫn_file"],
      "instructions": "Chỉ thị chi tiết cho Builder: sửa hàm nào, logic gì, chú ý gì",
      "depends_on": [],
      "verification_cmd": "lệnh kiểm tra nhanh như mix test / npm test (nếu có, không thì để trống)"
    }
  ]
}`;

    let userContent = `YÊU CẦU: "${prompt}"\n\n`;

    if (projectRules) {
      userContent += `QUY ƯỚC DỰ ÁN (RULES):\n${projectRules}\n\n`;
    }

    userContent += `${codeSkeleton}\n\nHãy phân tích và trả về JSON Plan chuẩn xác nhất!`;

    const response = await this.provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      { json: true, maxTokens: 4000 }
    );

    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      return JSON.parse(cleanJson) as Plan;
    } catch (e: any) {
      throw new Error(`Architect trả về JSON không hợp lệ: ${e.message}\nRaw: ${response.text.slice(0, 300)}`);
    }
  }
}
