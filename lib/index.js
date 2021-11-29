const { src, dest, parallel, series, watch } = require("gulp");
const loadPlugins = require('gulp-load-plugins')
const bs =require('browser-sync');

const plugins = loadPlugins()
const del = require("del"); //删除指定文件的依赖

//获取模板解析规则
const cwd = process.cwd(); //返回当前项目的路径地址
let config = {
    build: {
        src: 'src',
        dist: 'dist',
        temp: 'temp',
        public: 'public',
        paths: {
            styles: 'assets/style/*.scss',
            scripts: 'assets/scripts/*.js',
            pages: '*.html',
            images: 'assets/images/**',
            fonts: 'assets/fonts/**',

        }
    }
}

try {
  const  loadConfig = require(`${cwd}/pages.config.js`);
  config = Object.assign({}, config, loadConfig);
} catch (error) {
    
}

//定义服务器任务
const serve = () => {
  //watch 监听指定路径下文件是否发生变化 变化后调用对应的任务
  //scss， js,page这三个文件是需要经过编译处理的，因此需要在文件改变后进行对应的任务处理
  watch(config.build.paths.styles, {cwd:config.build.src}, style);
  watch(config.build.paths.scripts, {cwd:config.build.src}, script);
  watch(config.build.paths.pages, {cwd: config.build.src}, page);

  //我们一般情况下很少修改图片，字体图标及公共静态文件，因此在每次更新服务时不需要监听这些变化。以此来提高速度
  // watch("src/assets/images/**", image);
  // watch('src/assets/fonts/**', font);
  // watch('public/**', extra);

  //监听到这三个文件的变化 自动刷新浏览器
  watch([
    config.build.paths.images,
    config.build.paths.fonts,
  ],{cwd: config.build.src}, bs.reload);

  watch('**', {cwd:config.build.public }, bs.reload); //extra


  bs.init({
    notify: false, //是否每次更新弹出提示
    port: 8080, //指定端口
    open: true, //运行服务时是否自动打开浏览器
    // files: 'dist/**',// 监听指定路径下的变化来更新服务数据, 可以pipe到特定的任务执行bs.reload
    server: {
      baseDir: [config.build.dist, config.build.src, config.build.public], //服务器的根路径,可传入数组，如果对应路径查找不到，会依次按照索引的格式查找 
      routes: {
        '/node_modules': 'node_modules', //匹配对应路径下的文件映射关系
      }
    }
  })
}

//定义style任务
const style = () => {
  return src(config.build.paths.styles, { base: config.build.src, cwd: config.build.src }) //base 保留参数后的路径文件 及assets及后续文件结构不变
    .pipe(plugins.sass({ outputStyle: "expanded" })) //_开头的scss文件会被作为依赖文件忽略,定义格式，expanded完全展开符合我们通常格式
    .pipe(dest(config.build.dist))
    .pipe(bs.reload({stream: true}));
};

//脚本任务
const script = () => {
  return src(config.build.paths.scripts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.babel({ presets: [require("@babel/preset-env")] })) //使用最新特性转换
    .pipe(dest(config.build.dist))
    .pipe(bs.reload({stream: true}))
};

const page = () => {
  return src(config.build.paths.pages, { base: config.build.src, cwd: config.build.src }) // **/*的方式是指匹配src目录下的所有子目录下的文件
    .pipe(plugins.swig({ data: config.data }))
    .pipe(dest(config.build.dist))
    .pipe(bs.reload({stream: true}))
};

/*************************非必要更新文件 start**************************************/

//压缩图片和fonts文件（主要是svg）
const image = () => {
  return src(config.build.paths.images, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist))
    
};

const font = () => {
  return src(config.build.paths.fonts, { base: config.build.src, cwd: config.build.src })
    .pipe(plugins.imagemin())
    .pipe(dest(config.build.dist));
};

const extra = () => {
  return src('**', { base: config.build.public, cwd:config.build.public }).pipe(dest(config.build.dist));
};

const useref = () => {
  return src(config.build.paths.pages, {base: config.build.dist, cwd: config.build.dist}) //操作对象
  .pipe(plugins.useref({ searchPath: [config.build.dist, '.'] })) //查找地址 首选项为dist文件目录， 此选项为项目根路径
  .pipe(plugins.if(/\.js$/, plugins.uglify())) //处理js文件
  .pipe(plugins.if(/\.css$/, plugins.cleanCss())) //处理css文件
  .pipe(plugins.if(/\.html$/, plugins.htmlmin( { //处理html文件
    collapseWhitespace: true, //折叠空白符
    minifyCSS: true, //压缩style中的css
    minifyJS: true, //压缩script标签中的js
  })))
  .pipe(dest(config.build.dist)); //将处理后的结果输出到dist文件路径
}

/*************************非必要更新文件 end**************************************/
//编译过程互补干扰，采用并行方式,不编译图片字体文件，减少构建的内容，去对应的开发文件夹下获取。
const compile = parallel(style, script, page);

const clean = () => {
  return del(config.build.dist); //del是一个promise类型的方法
};

//由于我们每次的dist文件夹未被情况，这样会导致每次构建的结果不纯净，因此需要先删除dist文件，在生成，此处使用del插件,使用串行的方式
const build = series(clean,parallel(series(compile, useref), extra,image, font));


//开发任务
const dev = series(compile, serve); //先编译 再启动serve

module.exports = {
  build,
  dev,
};
