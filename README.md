# 250912_threejs_fluids

ICS MEDIA「[誰でも使える！ Three.jsでウェブサイトに2D流体表現を追加しよう](https://ics.media/entry/250912/)」のサンプルコードです。

## デモ

以下からデモを確認できます。

- [流体シミュレーションデモ1 速度場の可視化](https://ics-creative.github.io/250912_threejs_fluids/demo1.html)
- [流体シミュレーションデモ2 速度場に合わせて画像ワープ](https://ics-creative.github.io/250912_threejs_fluids/demo2.html)
- [流体シミュレーションデモ3 ピクセルの移動](https://ics-creative.github.io/250912_threejs_fluids/demo3.html)

## デモのアレンジ

デモにアレンジを加える場合は、主に下記の3点が変更しやすく、かんたんに見た目を変えられます。

### 外力の更新

- [createAddForceMaterial](https://github.com/ics-creative/250912_threejs_fluids/blob/main/src/tsl/createAddForceMaterial.ts#L30)

速度に与える外力の部分を変更します。サンプルコードではマウスドラッグで外力を与えていますが、他のインタラクションや自動的に変化する力に置き換えることも可能です。

サンプルではマウスを押しっぱなしにしているときだけ外力を加えるようになっているので、常に力を加えつづけたい場合は[外力の計算を行っている箇所](https://github.com/ics-creative/250912_threejs_fluids/blob/main/src/demo1.ts#L193)の`if`文を削除してください。

### レンダリング

- [createRenderMaterial1](https://github.com/ics-creative/250912_threejs_fluids/blob/main/src/tsl/createRenderMaterial1.ts#L30)

得られた速度場を使って流体の見た目をレンダリングする部分を変更します。サンプルコードでは速度場を色で可視化（デモ1）したり、速度場にしたがって背景画像をワープ（デモ2）や移流（デモ3）させています。

ここを他の表現に置き換えることも可能です。一番オリジナリティを出しやすい部分ですので、ぜひアレンジしてみてください。

### シミュレーション設定

- [simulationConfig](https://github.com/ics-creative/250912_threejs_fluids/blob/main/src/demo1.ts#L30)

シミュレーションに使用するテクスチャーの解像度などのパラメーターを変更します。解像度を上げるとより細かい流体表現が可能ですが、計算負荷が高くなります。

パフォーマンスに影響する項目があるため、モバイルなどで思うようにパフォーマンスが出ない場合にはこちらを調整ください。