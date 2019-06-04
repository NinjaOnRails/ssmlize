const axios = require('axios');

module.exports = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
  params: {
    part: 'snippet',
    key: process.env.REACT_APP_YOUTUBE_API,
  },
});
// 'AIzaSyD9TZEQX9cK7QO1vcJlZxUPvJTkdi-XUwU'