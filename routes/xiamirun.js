/*
* @Author: naoyeye
* @Date:   2018-03-16 14:07:25
* @Last Modified by:   naoyeye
* @Last Modified time: 2018-03-16 19:19:07
*/
'use strict';
var router = require('express').Router();

var XIAMI = require('./../utils/song');


var isXiamiSong = /(http(s)?:\/\/)?(www\.)?xiami.com\/(song\/[\w-./?%&=]*)?$/;

router.get('/', (req, res, next) => {
  res.render('index', {
    "result": null
  });
})

router.post('/', (req, res, next) => {

  var pageUrl = req.body.url;

  if (!pageUrl || !isXiamiSong.test(pageUrl)) {
    console.log('出错了')
    res.render('index', {
      'result': {
        'success': false,
        'url': null,
        'message':'url 有误，应为：http://www.xiami.com/song/xxxx 格式'
      }
    });

    // res.jsonp({
    //   'success': false,
    //   'url': null,
    //   'message':'url 有误，应为：http://www.xiami.com/song/xxxx 格式'
    // });
    // return;
  }

  var songFlag = pageUrl.split('song/')[1].split('?')[0]
  
  XIAMI.Song.getContent(songFlag).then((data) => {
    const songId = data.id
    const title = data.title
    let artists = ''

    data.artists.map((artistItem) => {
      // console.log('artistItem - ', artistItem)
      artists = artists + artistItem.name
    })

    // console.log(title, artists)

    // res.jsonp(data);

    XIAMI.Song.getHQAudioURL(songId).then((data) => {
      let _data = data;

      if (!data.success || !data.url) {
        _data.message = '获取失败';
      } else {
        _data.message = '获取成功';
        _data.title = title;
        _data.artists = artists;
      }
       res.render('index', {
        'result': _data,

      });
      // res.jsonp(_data);
    });
  })

});


module.exports = router;
