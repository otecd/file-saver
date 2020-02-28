# File saver

![](https://img.favpng.com/11/25/6/computer-icons-button-scalable-vector-graphics-png-favpng-LFZpgkZ2CMThpNEv1p6WLe2D4.jpg)


####build script

`$ npm run build`


#### example imageSaver
```javascript
	import { ImageSaver } from '@noname.team/file-saver

	const saver = new ImageSaver({ targetDir })

	await saver.process({
      fileName: downloadedFileName,
      transformer: '****/img.png',
      textOverlays: [{ text: 'test test', size: '16', color: 'white', customFont: '****/font.fnt' }],
      textPosition: { x: 55, y: 69 } //or string "north, west, northwest"
    })
```
