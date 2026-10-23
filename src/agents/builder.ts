import { exec } from 'child_process';
import { promisify } from 'util';
import { LLMProvider } from '../providers/base.js';
import { DAGStep } from '../types/index.js';
import { ContextSlicer } from '../core/slicer.js';
import { DiffEngine } from '../core/diff-engine.js';

const execAsync = promisify(exec);

export interface BuilderResult {
  success: boolean;
  modifiedFiles: string[];
  findings?: string;
  error?: string;
  patchPreviews: string[];
}

export class BuilderAgent {
  private provider: LLMProvider;

  constructor(provider: LLMProvider) {
    this.provider = provider;
  }

  async executeStep(
    step: DAGStep,
    blackboardSummary?: string,
    cwd: string = process.cwd()
  ): Promise<BuilderResult> {
    const patchPreviews: string[] = [];
    const modifiedFiles: string[] = [];

    // 1. Gather sliced context of target files
    let filesContext = '';
    for (const file of step.target_files) {
      const sliced = await ContextSlicer.sliceFile(file, step.instructions, cwd);
      filesContext += `\n--- FILE: ${file} (Tổng số dòng: ${sliced.totalLines}) ---\n${sliced.content}\n`;
    }

    const systemPrompt = `Bạn là Senior Software Engineer thực thi (Builder). 
Nhiệm vụ: Sửa mã nguồn theo yêu cầu một cách TỐI THIỂU, CHUẨN XÁC, tuân thủ PONYTAIL:
- Không viết dài dòng, không tạo hàm wrapper vô nghĩa.
- Chỉ sửa đúng các dòng cần sửa.
- Trả về các khối SEARCH/REPLACE theo đúng chuẩn:

### File: đường_dẫn_file
<<<<<<< SEARCH
// mã cũ chính xác từng ký tự trong file
=======
// mã mới thay thế
>>>>>>>

Nếu tạo file mới hoàn toàn, dùng khối:
### File: đường_dẫn_file
<<<<<<< SEARCH
=======
// toàn bộ nội dung file mới
>>>>>>>`;

    let userPrompt = `NHIỆM VỤ: ${step.instructions}\n`;
    if (blackboardSummary) {
      userPrompt += `\n${blackboardSummary}\n`;
    }
    userPrompt += `\nCÁC FILE MỤC TIÊU:${filesContext}\n\nHãy xuất các khối SEARCH/REPLACE:`;

    // 2. Generate and apply diff
    let attempt = 0;
    const maxAttempts = 3;
    let lastError = '';

    while (attempt < maxAttempts) {
      attempt++;
      let currentPrompt = userPrompt;
      if (lastError) {
        currentPrompt += `\n\n⚠️ LẦN THỰC THI TRƯỚC BỊ LỖI:\n${lastError}\nHãy tạo lại khối SEARCH/REPLACE để khắc phục lỗi này!`;
      }

      const response = await this.provider.generate([
        { role: 'system', content: systemPrompt },
        { role: 'user', content: currentPrompt },
      ]);

      const blocks = DiffEngine.parseDiffBlocks(response.text, step.target_files[0]);
      if (blocks.length === 0) {
        lastError = 'Không trích xuất được khối SEARCH/REPLACE nào từ câu trả lời của AI.';
        continue;
      }

      let applyFailed = false;
      for (const block of blocks) {
        const res = await DiffEngine.applyDiffBlock(block, cwd);
        if (!res.success) {
          applyFailed = true;
          lastError = res.error || 'Áp dụng diff thất bại.';
          break;
        }
        if (res.patchPreview) patchPreviews.push(res.patchPreview);
        if (!modifiedFiles.includes(block.file)) modifiedFiles.push(block.file);
      }

      if (applyFailed) continue;

      // 3. Verification Command (Self-Healing Loop)
      if (step.verification_cmd) {
        try {
          await execAsync(step.verification_cmd, { cwd });
          return {
            success: true,
            modifiedFiles,
            findings: `Đã sửa thành công các file: ${modifiedFiles.join(', ')} và vượt qua lệnh kiểm tra (${step.verification_cmd}).`,
            patchPreviews,
          };
        } catch (cmdError: any) {
          const stderr = cmdError.stderr || cmdError.stdout || cmdError.message;
          const truncatedLog = stderr.split('\n').slice(-30).join('\n');
          lastError = `Lệnh kiểm tra [${step.verification_cmd}] thất bại:\n${truncatedLog}`;
          continue; // Self-heal on next iteration
        }
      } else {
        return {
          success: true,
          modifiedFiles,
          findings: `Đã áp dụng các thay đổi vào: ${modifiedFiles.join(', ')}.`,
          patchPreviews,
        };
      }
    }

    return {
      success: false,
      modifiedFiles,
      error: `Thất bại sau ${maxAttempts} lần thử. Lỗi cuối cùng: ${lastError}`,
      patchPreviews,
    };
  }
}
