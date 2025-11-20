/**
 * 業界マスタ定数
 * カテゴリーに紐づけて用語解説の精度を向上させる
 */

export const INDUSTRIES = [
  { value: 'healthcare', label: '医療' },
  { value: 'elderly_care', label: '介護' },
  { value: 'nursing', label: '看護' },
  { value: 'it', label: 'IT・ソフトウェア' },
  { value: 'ai_ml', label: 'AI・機械学習' },
  { value: 'finance', label: '金融' },
  { value: 'legal', label: '法律' },
  { value: 'education', label: '教育' },
  { value: 'manufacturing', label: '製造業' },
  { value: 'real_estate', label: '不動産' },
  { value: 'retail', label: '小売・流通' },
  { value: 'consulting', label: 'コンサルティング' },
  { value: 'construction', label: '建設業' },
  { value: 'other', label: 'その他' },
] as const;

export type IndustryValue = typeof INDUSTRIES[number]['value'];

/**
 * 業界コードから日本語ラベルを取得
 */
export function getIndustryLabel(value: string): string {
  return INDUSTRIES.find(ind => ind.value === value)?.label || value;
}

/**
 * 複数の業界コードから日本語ラベルの配列を取得
 */
export function getIndustryLabels(values: string[]): string[] {
  return values.flatMap(value => {
    const label = INDUSTRIES.find(ind => ind.value === value)?.label;
    return label ? [label] : [];
  });
}
