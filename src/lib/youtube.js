const axios = require('axios');

module.exports = axios.create({
  baseURL: 'https://www.googleapis.com/youtube/v3',
  params: {
    part: 'snippet',
    key: 'AIzaSyD9TZEQX9cK7QO1vcJlZxUPvJTkdi-XUwU',
  },
});
