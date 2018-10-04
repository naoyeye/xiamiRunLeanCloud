/*
* @Author: naoyeye
* @Date:   2018-03-16 14:07:25
* @Last Modified by:   hanjiyun
* @Last Modified time: 2018-09-30 15:58:45
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
    res.render('index', {
      result: data,
    })
  }).catch(err => {
    console.error(err)
    res.render('index', {
      result: {
        success: false,
        message: '获取失败'
      }
    })
  })
})


module.exports = router
