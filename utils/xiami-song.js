
require('isomorphic-fetch')

const _URL         = require('url')
const queryString  = require('querystring')

const g = global

// 解析 xiami 音乐地址
const _decodeLocation = (location) => {
  let loc2 = parseInt(location.substr(0, 1))
  let loc3 = location.substr(1)
  let loc4 = Math.floor(loc3.length / loc2)
  let loc5 = loc3.length % loc2
  let loc6 = []
  let loc7 = 0
  let loc8 = ''
  let loc9 = ''
  let loc10 = ''
  while (loc7 < loc5) {
    loc6[loc7] = loc3.substr((loc4 + 1) * loc7, loc4 + 1)
    loc7++
  }
  loc7 = loc5
  while (loc7 < loc2) {
    loc6[loc7] = loc3.substr(loc4 * (loc7 - loc5) + (loc4 + 1) * loc5, loc4)
    loc7++
  }
  loc7 = 0
  while (loc7 < loc6[0].length) {
    loc10 = 0
    while (loc10 < loc6.length) {
      loc8 += loc6[loc10][loc7] !== undefined ? loc6[loc10][loc7] : ''
      loc10++
    }
    loc7++
  }

  loc9 = decodeURIComponent(loc8).replace(/\^/g, '0')
  return loc9
}

// 随机国内 ip
const randomChinaIpAddress = () => {
  return `211.161.244.${Math.floor(254 * Math.random())}`
}

// 取虾米 token
// 其实只要匿名访问虾米的随便一个页面都可以拿到
// 这里为了省事，用了之前的一段代码
const getXiamiToken = () =>
  new Promise((resolve, reject) => {
    // const tokenAPI = 'mtop.alimusic.xiami.user.accountservice.loginxiami'
    fetch(`https://login.xiami.com/member/login`)
      .then(res => {
        // console.log('res.headers = ', res.headers._headers['set-cookie'].join(';').split(';'))

        let cookiesArray = res.headers._headers['set-cookie'].join(';').split(';')
        let _cookiesArray = []
        cookiesArray.map((item, index) => {
          item = item.trim().substr(0, item.length)
          // console.log('item =', item, item.length)
          // if ([0, 4, 6, 10].includes(index)) {
            _cookiesArray.push(item)
          // }
          
        })

        // console.log(_cookiesArray)

        resolve({
          cookie: _cookiesArray
        })
      })
      .catch(err => {
        reject(err)
      })
  })


// 根据 mid 取 id
const getSongIdbyMid = (mid) => {
  // 如果没有 token
  if (!g.gotCookie) {
    return new Promise((resolve, reject) => {
      // console.log('没有 token')
      getXiamiToken()
        .then(data => {
          g.gotCookie = true
          g.COOKIE = data.cookie
          // console.log('data.cookie - ', data.cookie)
          // g.XIAMI_TOKEN = data.cookie.token;
          // g.XIAMI_SIGNED_TOKEN = tokenObj.signedToken;
          // g.ENC = tokenObj.enc;

          // console.log('拿到token = ', g.XIAMI_TOKEN, g.XIAMI_SIGNED_TOKEN)

          return getSongIdbyMid(mid)
        })
        // .then(res => {
        //   console.log('res = ', res)
        //   resolve(res);
        // })
        .catch(err => {
          reject(err);
        })
    })
  }


  return new Promise((resolve, reject) => {
    // console.log('已经有 token', g.XIAMI_TOKEN)
    // let cookie = `gid=151646555299455; _unsign_token=934af81469bfb1db843e01b6b7e08360; ${g.COOKIE}`
    // let cookie = `_unsign_token=05031b5b3b1fb1ac9d6eda3417cdcdb1; xm_token=c2c45d1ded4e4b2b6f4f1a69ba7bc0da; _xiamitoken=a62038d65bb3246dcaef61a454022472; _m_h5_tk=054584f879b804a8856ad354cc57c35d_1538664700568; _m_h5_tk_enc=f1443dbb7805b777b368cda0bf0d3465; x5sec=7b22617365727665723b32223a223064396564393034353166666337333461366566303032623032373838376565434d5356324e3046454c4b427a656a757864654663773d3d227d; `

    let cookie = g.COOKIE.join('; ')

    // console.log('cookie = ', cookie)


    const options = {
      mode: 'no-cors',
      method: 'GET',
      headers: {
        'Referer': 'https://h.xiami.com/',
        // 模拟手机访问
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 7_1_2 like Mac OS X) AppleWebKit/537.51.2 (KHTML, like Gecko) Version/7.0 Mobile/11D257 Safari/9537.53',
        'X-Real-IP': randomChinaIpAddress(),
        'Cookie': cookie,
        'accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'accept-encoding': 'br, gzip, deflate',
        'Pragma': 'no-cache',
        'Cache-Control': 'no-cache',
        'accept-language': 'zh,en-US;q=0.9,en;q=0.8'
      }
    }

    /* 原理:
      利用移动端访问 https://www.xiami.com/song/[mid] 时会被自动 301 跳转到虾米的手机站：
      https://h.xiami.com/song.html?id=[id]&f=&from=&disabled=
      所以模拟手机访问歌曲页面，然后就能拿到跳转链接里的歌曲 id 了
    */
    fetch(`https://www.xiami.com/song/${mid}`, options)
      .then(res => {

        // console.log('res - ', res)

        // 拿到跳转链接
        let h5Url = res.url

        console.log('h5Url - ', h5Url)

        let songId = 0

        try {
          songId = queryString.parse(_URL.parse(h5Url).query).id
        }
        catch(err) {
          reject({
            success: false,
            message: '访问受限了 code:1',
            url: h5Url
          })
        }

        // console.log('songId - ', songId, typeof songId)

        // id 是数字
        if (songId && !isNaN(songId)) {
          resolve({
            success: true,
            id: songId
          })
        } else {
          reject({
            success: false,
            message: '访问受限了 code:2',
            url: h5Url
          })
        }
      })
      .catch(err => {
        console.error('取 h5Url 出错了', err)
        reject({
          success: false,
          message: '请求虾米歌曲地址时出错'
        })
      })
  })
  
}

// 自己写的一个第三方服务
const fetchDouting = (songId) => {
  return new Promise((resolve, reject) => {
    const doutingUrl = `https://douting.leanapp.cn/api/get/song/xiami?id=${songId}`

    fetch(doutingUrl)
      .then(res => res.json())
      .then(json => {
        console.log('json - ', json)
        if (!json.success) {
          reject({
            success: false,
            message: '请求虾米歌曲信息时出错'
          })
        }
        const title = json.name
        const artists = json.artist.name
        const albumTitle = json.album.name
        const coverURL = json.album.cover
        const url = json.url

        resolve({
          success: true,
          id: songId,
          title: title,
          coverURL: coverURL,
          albumTitle: albumTitle,
          artists: artists,
          url: url
        })
      })
      .catch(err => {
        console.error('请求 h5Url 出错了', err)
        reject({
          success: false,
          message: '请求虾米歌曲信息时出错'
        })
      })
  })
}


const getSongContent = (mid) => {
  return new Promise((resolve, reject) => {
    let songId = mid

    // 如果 mid 已经是数字，就不用去取数字 id 了
    if (!isNaN(songId)) {
      // console.log('1 getSongContent songId - ', songId)
      fetchDouting(songId).then(result => resolve(result)).catch(err => reject(err))
    } else {
      // console.log('2 getSongContent songId - ', songId)

      getSongIdbyMid(mid).then(data => {
        // 拿到 301 跳转后的歌曲 id

        // console.log('data - ', data)

        if (!data.success) {
          reject(data)
        }

        songId = data.id

        // console.log('songId = ', songId)

        fetchDouting(songId).then(result => resolve(result)).catch(err => reject(err))

      }).catch(err => {
        console.error('getSongIdbyMid 出错了', err)
        reject(err)
      })
    }
  })
}




module.exports = {
  getSongContent
}
