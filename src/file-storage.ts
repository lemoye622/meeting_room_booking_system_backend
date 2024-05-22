import * as multer from "multer";
import * as fs from 'fs';

const storage = multer.diskStorage({ // 磁盘存储
    // 通过 destination、filename 两个参数分别指定保存的目录和文件名
    destination: function(req, file, callback) {
        try {
            fs.mkdirSync('uploads');
        } catch (error) {
            callback(null, 'uploads')
        }
    },
    filename: function(req, file, callback) {
        // 用时间戳 Date.now() 加上Math.random() 乘以 10 的 9 次方，然后取整，之后加上原来的文件名
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9) + '-' + file.originalname
        callback(null, uniqueSuffix);
    },
});

export { storage };