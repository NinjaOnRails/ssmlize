import React, { Component } from 'react';
import axios from 'axios';
import { parseString } from 'xml2js';
import youtube from './lib/youtube';

const charLimit = 5000;
const youtubeIdLength = 11;

class App extends Component {
  state = {
    source: '',
    ssml: '',
    isSsml: false,
    ssmlLanguage: 'vi',
    ssmlBreak: 500,
    youtubeId: '',
    textareaHeight: 20,
    ssmlObject: null,
    ssmlPart: '0',
    image: '',
    channelTitle: '',
    originTitle: '',
    languageTags: [],
    parsedXml: {},
    xmlLength: 0,
  };

  handleChange = e => {
    const { name, type, value } = e.target;
    const {
      languageTags,
      ssmlLanguage,
      source,
      ssmlBreak,
      ssmlPart,
      ssmlObject,
    } = this.state;
    const val = type === 'number' ? parseInt(value, 10) : value;

    if (name === 'source' && val.length >= 11 && val !== source)
      this.onSourceFill(val);
    if (name === 'ssmlBreak' && val >= 0 && val !== ssmlBreak)
      this.formatSsml(undefined, undefined, val);
    if (
      name === 'ssmlLanguage' &&
      val.length >= 2 &&
      languageTags.includes(val) &&
      val !== ssmlLanguage
    )
      this.getSsml(val);

    if (name === 'ssmlPart' && val !== ssmlPart) {
      this.setState({
        ssmlPart: val,
        ssml: ssmlObject[val],
        textareaHeight: parseInt(
          this.state.ssmlObject[val].split('\n').length,
          10
        ),
      });
    }

    this.setState({ [name]: val });
  };

  onSourceFill = async source => {
    // Check if source is YouTube and extract ID from it
    const youtubeId = source.trim();
    const sourceYouTube = [
      { domain: 'https://youtube.com/watch?v=', length: 28 },
      { domain: 'http://youtube.com/watch?v=', length: 27 },
      { domain: 'https://www.youtube.com/watch?v=', length: 32 },
      { domain: 'http://www.youtube.com/watch?v=', length: 31 },
      { domain: 'youtube.com/watch?v=', length: 20 },
      { domain: 'www.youtube.com/watch?v=', length: 24 },
      { domain: 'https://youtu.be/', length: 17 },
      { domain: 'https://www.youtu.be/', length: 21 },
      { domain: 'http://youtu.be/', length: 16 },
      { domain: 'http://www.youtu.be/', length: 20 },
      { domain: 'youtu.be/', length: 9 },
      { domain: 'www.youtu.be/', length: 13 },
    ];
    const isYouTube = sourceYouTube.find(value =>
      youtubeId.startsWith(value.domain)
    );
    let originId;
    if (isYouTube) {
      const { length } = isYouTube;
      originId = youtubeId.slice(length, length + youtubeIdLength);
    } else if (youtubeId.length === youtubeIdLength) {
      originId = youtubeId;
    } else {
      throw new Error('No valid YouTube source was provided');
    }

    if (this.state.youtubeId !== originId) {
      // Fetch info from Youtube
      try {
        const res = await youtube.get('/videos', {
          params: {
            id: originId,
          },
        });

        if (!res.data.items.length)
          throw new Error('Video not found on Youtube');

        const {
          thumbnails: {
            medium: { url },
          },
          channelTitle,
          localized: { title },
          defaultAudioLanguage,
        } = res.data.items[0].snippet;

        this.setState({
          youtubeId: originId,
          image: url,
          originTitle: title,
          channelTitle,
        });
        try {
          const {
            data: { items },
          } = await youtube.get('/captions', {
            params: {
              videoId: originId,
            },
          });
          if (!items) throw new Error('No captions found');

          const languageTags = [];
          items.forEach(({ snippet: { language } }) => {
            if (!languageTags.includes(language)) languageTags.push(language);
          });

          this.setState({ languageTags });
          if (!languageTags.includes(this.state.ssmlLanguage)) {
            this.setState({ ssmlLanguage: languageTags[0] });
            this.getSsml(languageTags[0]);
          } else {
            this.getSsml();
          }
        } catch (err) {
          console.log(err);
        }
      } catch (err) {
        console.log(err);
      }
    }
  };

  getSsml = async (ssmlLanguage = this.state.ssmlLanguage) => {
    const { youtubeId } = this.state;
    try {
      const { data } = await axios.get(
        `https://www.youtube.com/api/timedtext?lang=${ssmlLanguage}&v=${youtubeId}`
      );

      if (!data) throw new Error('Could not fetch XML');

      parseString(data, (err, { transcript: { text } }) => {
        this.setState({
          parsedXml: { ...text },
          xmlLength: text.length,
          ssmlPart: '0',
        });
        this.formatSsml({ ...text }, text.length);
      });
    } catch (err) {
      console.log(err);
    }
  };

  formatSsml(
    texts = this.state.parsedXml,
    xmlLength = this.state.xmlLength,
    ssmlBreak = this.state.ssmlBreak
  ) {
    const ssml = {};
    let n = 0;
    ssml[n] = '';
    for (let i = 0; i < xmlLength - 1; i += 1) {
      const breakTime = (
        parseInt(
          (parseFloat(texts[i + 1].$.start) -
            parseFloat(texts[i].$.start) -
            parseFloat(texts[i].$.dur)) *
            100,
          10
        ) + ssmlBreak
      )
        .toFixed(2)
        .toString();
      const breakTag = ` <break time=\\"${breakTime}ms\\" />`;
      //   const breakTag =
      //     breakTime > 0 ? ` <break time=\\"${breakTime}s\\" />` : '';
      const line = texts[i]._ + breakTag + '\n';
      if ((ssml[n] + line).length <= charLimit) {
        ssml[n] += line;
      } else {
        n += 1;
        ssml[n] = line;
      }
    }

    this.setState({
      ssmlObject: { ...ssml },
      ssml: ssml[this.state.ssmlPart],
      textareaHeight: parseInt(ssml[0].split('\n').length, 10),
    });
  }

  render() {
    const {
      source,
      ssml,
      isSsml,
      ssmlLanguage,
      ssmlBreak,
      textareaHeight,
      ssmlObject,
      ssmlPart,
      image,
      originTitle,
      channelTitle,
      languageTags,
    } = this.state;
    return (
      <div className="ui container" style={{ marginTop: '10px' }}>
        <div className="ui segment">
          <form className="ui form">
            <div className="field">
              <label htmlFor="source">
                YouTube Link/ID:
                <input
                  type="text"
                  id="source"
                  name="source"
                  required
                  placeholder="eg.'0Y59Yf9lEP0' or 'https://www.youtube.com/watch?v=h4Uu5eyN6VU'"
                  value={source}
                  onChange={this.handleChange}
                />
              </label>
              {originTitle && <div>{originTitle}</div>}
              {channelTitle && <div>{channelTitle}</div>}
              {image && <img width="200" src={image} alt="thumbnail" />}
              <div>
                <label htmlFor="">Break time (ms):</label>
                <input
                  type="number"
                  name="ssmlBreak"
                  min="0"
                  max="30000"
                  step="10"
                  placeholder="ví dụ '500'"
                  value={ssmlBreak}
                  onChange={this.handleChange}
                />
                {languageTags &&
                  languageTags.map(languageTag => (
                    <span key={languageTag}>{languageTag} </span>
                  ))}
                <input
                  type="text"
                  name="ssmlLanguage"
                  placeholder="ví dụ 'vi'"
                  value={ssmlLanguage}
                  onChange={this.handleChange}
                />
              </div>

              {ssmlObject && (
                <>
                  <label htmlFor="">
                    {Object.keys(ssmlObject).map(key => (
                      <li key={key}>
                        <input
                          type="radio"
                          name="ssmlPart"
                          value={key}
                          checked={ssmlPart === key}
                          onChange={this.handleChange}
                        />
                        {key}
                      </li>
                    ))}
                  </label>
                  <textarea
                    type="textarea"
                    name="ssml"
                    value={ssml}
                    onChange={this.handleChange}
                    rows={Math.round(textareaHeight)}
                  />
                </>
              )}
            </div>
          </form>
        </div>
      </div>
    );
  }
}

export default App;
