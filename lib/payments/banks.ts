export type BankOption = {
  id: string;        // VietQR BIN/code used in the QR URL (e.g. "970403")
  bin: string;       // same as id (kept explicit for clarity in QR building)
  code: string;      // short banking code (e.g. "STB")
  shortName: string; // display short name shown to customers/admin
  name: string;      // full Vietnamese bank name
};

// Only the banks SePay's QR/transfer recognition supports. Keep this list in sync
// with the SePay dashboard bank picker — do not add banks SePay cannot match.
export const SEPAY_SUPPORTED_BANKS: BankOption[] = [
  { id: '970436', bin: '970436', code: 'VCB',  shortName: 'Vietcombank',  name: 'Ngân hàng TMCP Ngoại thương Việt Nam' },
  { id: '970403', bin: '970403', code: 'STB',  shortName: 'Sacombank',    name: 'Ngân hàng TMCP Sài Gòn Thương Tín' },
  { id: '970423', bin: '970423', code: 'TPB',  shortName: 'TPBank',       name: 'Ngân hàng TMCP Tiên Phong' },
  { id: '970432', bin: '970432', code: 'VPB',  shortName: 'VPBank',       name: 'Ngân hàng TMCP Việt Nam Thịnh Vượng' },
  { id: '970415', bin: '970415', code: 'ICB',  shortName: 'VietinBank',   name: 'Ngân hàng TMCP Công thương Việt Nam' },
  { id: '970416', bin: '970416', code: 'ACB',  shortName: 'ACB',          name: 'Ngân hàng TMCP Á Châu' },
  { id: '970418', bin: '970418', code: 'BIDV', shortName: 'BIDV',         name: 'Ngân hàng TMCP Đầu tư và Phát triển Việt Nam' },
  { id: '970422', bin: '970422', code: 'MBB',  shortName: 'MBBank',       name: 'Ngân hàng TMCP Quân đội' },
  { id: '970448', bin: '970448', code: 'OCB',  shortName: 'OCB',          name: 'Ngân hàng TMCP Phương Đông' },
  { id: '970452', bin: '970452', code: 'KLB',  shortName: 'KienLongBank', name: 'Ngân hàng TMCP Kiên Long' },
  { id: '970426', bin: '970426', code: 'MSB',  shortName: 'MSB',          name: 'Ngân hàng TMCP Hàng Hải Việt Nam' },
];

// Backward-compatible alias — existing imports use BANK_OPTIONS.
export const BANK_OPTIONS: BankOption[] = SEPAY_SUPPORTED_BANKS;

export function findBankById(id: string): BankOption | undefined {
  return SEPAY_SUPPORTED_BANKS.find((b) => b.id === id || b.bin === id);
}

export function findBankByShortName(shortName: string): BankOption | undefined {
  const q = (shortName ?? '').toLowerCase();
  return SEPAY_SUPPORTED_BANKS.find(
    (b) => b.shortName.toLowerCase() === q || b.code.toLowerCase() === q
  );
}
