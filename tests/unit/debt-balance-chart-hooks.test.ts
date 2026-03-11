import { ESLint } from 'eslint';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

describe('DebtBalanceChart hooks safety', () => {
  it('does not call hooks conditionally after the empty-data return path', async () => {
    const __filename = fileURLToPath(import.meta.url);
    const __dirname = path.dirname(__filename);
    const filePath = path.resolve(__dirname, '../../src/components/charts/DebtBalanceChart.tsx');

    const eslint = new ESLint({ cwd: path.resolve(__dirname, '../..') });
    const [result] = await eslint.lintFiles([filePath]);

    const hookOrderErrors = result.messages.filter(
      message => message.ruleId === 'react-hooks/rules-of-hooks',
    );

    expect(result.fatalErrorCount).toBe(0);
    expect(hookOrderErrors).toHaveLength(0);
  });
});
