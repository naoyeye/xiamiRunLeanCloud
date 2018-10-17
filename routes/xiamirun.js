/*
* @Author: naoyeye
* @Date:   2018-03-16 14:07:25
* @Last Modified by:   hanjiyun
* @Last Modified time: 2018-10-17 17:33:17
*/
'use strict';
const router = require('express').Router()
const XIAMIAPI = require('./../utils/xiami-api')

const isXiamiSong = /(http(s)?:\/\/)?(www\.)?xiami.com\/(song\/[\w-./?%&=]*)$/


router.get('/', (req, res, next) => {
  res.render('index', {
    result: null
  })
})

router.post('/', (req, res, next) => {
  const pageUrl = req.body.url

  if (!pageUrl || !isXiamiSong.test(pageUrl)) {
    res.render('index', {
      result: {
        success: false,
        url: null,
        message:'url 有误，应为：https://www.xiami.com/song/xxxx 格式'
      }
    })
    return
  }

  const songMid = pageUrl.split('song/')[1].split('?')[0]
  
  XIAMIAPI.Song.getContent(songMid).then((data) => {
    // console.log('data = ', data)
    res.render('index', {
      result: data,
    })
  }).catch(err => {
    console.error('出错了', err)
    res.render('index', {
      result: {
        success: false,
        message: err.message
      }
    })
  })
})


module.exports = router
