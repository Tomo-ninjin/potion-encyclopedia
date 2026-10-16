# ポーション図鑑（API接続版）

画面はGitHub Pages、検索データはCloudflare Workersで管理します。公開用script.jsには図鑑データを含めません。検索・履歴からの再表示には通信が必要です。

## アップロードするファイル

公開用ZIPの中身だけをGitHubへアップロードしてください。index.html、style.css、script.js、README.md、images/です。worker-search.mjsはCloudflare用の非公開管理コードです。GitHubにはアップロードしないでください。

## ローカル確認

このフォルダで `python -m http.server 8000 --bind 127.0.0.1` を実行し、http://127.0.0.1:8000 を開きます。終了はCtrl+Cです。ファイルを直接開く方法ではAPI通信を利用できません。

## データ・画像の変更

Cloudflareの対象WorkerでEdit codeを開き、POTIONS内のname（名前）、color（色）、material1・material2（素材）、effect（効果）、uses（使用回数）、image（画像）を変更してDeployします。idは重複しない固定IDにします。追加は配列の項目を複製し、項目間をカンマで区切ります。削除は対象項目と余分なカンマを除去します。

画像は未設定なら空枠です。後で公開サイトのimages/に置き、Workerのimageに「images/ファイル名.png」のような相対パスを指定できます。公開画像のファイル名に答えを入れないようにしてください。

## 履歴とリセット

成功した名前だけをlocalStorageに検索順・重複なしで保存します。履歴から開く場合もAPIを呼びます。通信失敗や未登録の場合は履歴を追加しません。旧静的版とは保存キーが異なるため、切り替え時は空の履歴から始まります。

右上48px四方を、操作間隔5秒以内で10回タップ・クリックすると履歴と入力をリセットし、管理者用モーダルを表示します。script.js冒頭のENABLE_ADMIN_RESETをfalseにすると操作領域と機能を無効にできます。ConsoleのresetEncyclopediaHistory()は常時利用可能です。保存キーはpotion-encyclopedia.api-history.v1です。localStorageが使えない環境では、そのページを開いている間だけ履歴を保持します。

## GitHub Pagesと接続設定

Settings → PagesでDeploy from a branch、公開対象ブランチ、/ (root)を設定します。更新後はActionsで最新コミットのデプロイ成功を確認します。script.jsのAPI_URLがWorkerのURLです。公開ドメインを変えるときはWorkerのALLOWED_ORIGINSも変更します（パスは含めません）。

## 公演前

iPhone SafariとAndroid Chromeで検索・記憶・再読み込み・通信失敗時の表示を確認してください。本番前は管理者リセットをfalseにしてください。登録名一覧や本番データを公開リポジトリ・README・履歴に残さないでください。過去に公開したデータはAPI版に置き換えてもGit履歴からは消えません。

全件データをブラウザに配信しませんが、検索名を推測して試すことは可能です。Originの制限はブラウザ向けの設定であり、APIの認証や大量検索対策ではありません。現在のWorkerにはリクエスト数の制限機構は追加していません。
