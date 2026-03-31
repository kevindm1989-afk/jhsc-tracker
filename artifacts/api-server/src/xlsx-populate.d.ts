declare module "xlsx-populate" {
  interface Cell {
    value(): unknown;
    value(v: string | number | boolean | null): Cell;
  }
  interface Sheet {
    cell(address: string): Cell;
    cell(row: number, col: number): Cell;
    name(): string;
  }
  interface Workbook {
    sheet(name: string): Sheet | undefined;
    sheet(index: number): Sheet | undefined;
    sheets(): Sheet[];
    deleteSheet(name: string): Workbook;
    deleteSheet(index: number): Workbook;
    outputAsync(type?: "nodebuffer" | "arraybuffer" | "base64"): Promise<Buffer>;
  }
  const XlsxPopulate: {
    fromDataAsync(data: Buffer | ArrayBuffer): Promise<Workbook>;
    fromFileAsync(path: string): Promise<Workbook>;
  };
  export = XlsxPopulate;
}
