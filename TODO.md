# TODO

- [x] viewport ごとのデータの取得は、 puppeteer 側のリサイズで一度に取得するようにしたい。fetchRawLayoutData を拡張する。
  - fetchRawLayoutDataViewportMatrix 関数を実装
  - captureLayoutMatrix 関数を実装
  - check.ts の calibration と capture を最適化
