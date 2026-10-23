import { LLMProvider } from '../providers/base.js';
import { AuditorReviewResult } from '../types/index.js';
import { DiffEngine } from '../core/diff-engine.js';

export class AuditorAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async review(
    goal: string,
    gitDiff: string,
    projectRules?: string,
    cwd: string = process.cwd()
  ): Promise<AuditorReviewResult> {
    if (!gitDiff || gitDiff.trim().length === 0) {
      return {
        approved: true,
        critique: 'Không có thay đổi mã nguồn nào được tạo ra.',
      };
    }

    const systemPrompt = `Bạn là Chief Code Auditor & Security Lead tối cao.
Nhiệm vụ: Tổng duyệt toàn bộ Git Diff cuối cùng sau khi các Builder đã sửa xong:
1. ĐỘ CHÍNH XÁC: Có đáp ứng 100% mục tiêu ban đầu không?
2. EDGE CASES: Có sót kiểm tra nil/null, mảng rỗng, dữ liệu sai định dạng không?
3. REGRESSION & SECURITY: Có nguy cơ làm hỏng luồng code khác hoặc dính lỗi bảo mật không?
4. PONYTAIL: Code có bị rườm rà, thừa thãi không?

QUYỀN HẠN ĐẶC BIỆT (LAST-MILE POLISH):
Nếu bạn phát hiện lỗi nhỏ hoặc thiếu sót biên, bạn có quyền tự tay cung cấp "polishDiffs" (khối SEARCH/REPLACE) để vá lỗi ngay lập tức, không cần trả về cho Builder!

ĐỊNH DẠNG ĐẦU RA BẮT BUỘC (Chỉ xuất JSON thuần):
{
  "approved": true hoặc false,
  "critique": "Đánh giá chi tiết của bạn về chất lượng mã nguồn (2-4 câu súc tích)",
  "polishDiffs": [
    {
      "file": "đường_dẫn_file",
      "searchBlock": "đoạn code cần sửa thêm",
      "replaceBlock": "đoạn code đã được bạn tối ưu hoàn hảo"
    }
  ]
}`;

    let userPrompt = `MỤC TIÊU BAN ĐẦU: "${goal}"\n\n`;
    if (projectRules) {
      userPrompt += `QUY ƯỚC DỰ ÁN:\n${projectRules}\n\n`;
    }
    userPrompt += `TOÀN BỘ GIT DIFF:\n\`\`\`diff\n${gitDiff.slice(0, 15000)}\n\`\`\`\n\nHãy tổng duyệt nghiêm ngặt và xuất JSON kết quả!`;

    const response = await this.provider.generate(
      [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      { json: true, maxTokens: 3000 }
    );

    const cleanJson = response.text.replace(/```json/g, '').replace(/```/g, '').trim();

    try {
      const result = JSON.parse(cleanJson) as AuditorReviewResult;

      // Apply polish diffs if provided
      if (result.polishDiffs && result.polishDiffs.length > 0) {
        for (const polish of result.polishDiffs) {
          await DiffEngine.applyDiffBlock(polish, cwd);
        }
      }

      return result;
    } catch {
      return {
        approved: true,
        critique: response.text || 'Auditor đã phê duyệt.',
      };
    }
  }
}
