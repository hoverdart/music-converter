from flask import Flask, render_template, request, redirect, flash, send_file
import asyncio
import yt_dlp as youtube_dl
import os
import json
from youtube_search import YoutubeSearch
import random
import string as STRING
import threading
from werkzeug.utils import secure_filename
#import jsonify
app=Flask(__name__, template_folder="templates")
app.config['SECRET_KEY'] = 'somethingVerySus'
UPLOAD_FOLDER = '/'
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
guildID={}

async def modify(link, file, name, type, modify, speed=False, sameName=False):
    tyepe = '.' + type
    if name == '':
        ec = ''.join(random.SystemRandom().choice(STRING.ascii_letters + STRING.digits) for _ in range(10))
        output = ec + '.' + type
    else:
        name=name[:200]
        if tyepe not in name:
            output = name + tyepe
        output=output.replace(' ', '_')
    if link != '':
        print('run')
        filename=await run(link, 'mp4', '', True)
    else:
        filename = secure_filename(file.filename)
        file.save(os.path.join(app.config['UPLOAD_FOLDER'], filename))
    # " -af acrusher=.1:1:64:0:log " replace when done
    keyStuff = {'pain': " -af acrusher=.1:1:64:0:log ", 'bass': " -af \"firequalizer=gain_entry='entry(0,10);entry(250,5);entry(1000,0);entry(4000,0);entry(16000,0)'\" ", 'speed': ' -filter:a \"atempo=2.0\" -vn ', 'slow': ' -filter:a \"atempo=0.5\" -vn ', 'high': ' -af asetrate=44100*4/3,aresample=44100,atempo=0.8 ', 'low': ' -af asetrate=44100*0.6,aresample=44100,atempo=1.8 ', 'reverse': ' -vf reverse -af areverse ', 'echo': ' -map 0 -c:v copy -af aecho=0.8:0.9:1000:0.3 ', 'norm':' -vn -ab 128k -ar 44100 -y '}
    filenamee='/home/runner/MusiConvert/'+filename
    if filename == output:
        output = '_'+output
    if '(' in output:
      output = output.replace('(', '[')
    if ')' in output:
      output = output.replace(')', ']')
    if 'url("https://images.unsplash.com/photo-1608754482805-6f630357358b?ixlib=rb-1.2.1&ixid=MnwxMjA3fDB8MHxzZWFyY2h8Mnx8c3BhY2UlMjBiYWNrZ3JvdW5kfGVufDB8fDB8fA%3D%3D&w=1000&q=80")' in filenamee:
        return 'html'
    else: # -vn -ab 128k -ar 44100 -y 
        cmd='ffmpeg -i '+filenamee+str(keyStuff[modify])+output
        print(cmd)
        proc = await asyncio.create_subprocess_shell(cmd, stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
        stdout, stderr = await proc.communicate()
        print(f'[{cmd!r} exited with {proc.returncode}]')
        if stdout:
            print(f'[stdout]\n{stdout.decode()}')
        if stderr:
            print(f'[stderr]\n{stderr.decode()}')
        return output, os.remove(filenamee)

#youtube-dl --get-duration O6w6GCm8wJI
async def getName(url):
  res = YoutubeSearch(url, max_results=1).to_json()
  results = json.loads(res)
  try:
    leVideo = results['videos'][0]
  except Exception as e:
    print(e)
    print('This has been triggered, the link is invalid')
    flash('Invalid Link/Search Query! Please try again.')
    return render_template('index.html')
  else:
    print(leVideo)
    return leVideo['title'][:200]
    
async def download_bytesio(url, ydl_opts=None):
    if not ydl_opts:
      ydl_opts = {
          'format': 'best[ext=mp4]',
          'outtmpl': '-',
          'logger': logging.getLogger()
      }

    video = BytesIO()
    with redirect_stdout(video):
        with youtube_dl.YoutubeDL(ydl_opts) as ydl:
            ydl.download([url])
    return video
  
async def run(url, type, name, speed=False, sameName=False):
    runNextCmd=False
    tyepe='.'+type
    if name == '':
        name = ''.join(random.SystemRandom().choice(STRING.ascii_letters + STRING.digits) for _ in range(10))
        outtmpl = name + '.mp4'
    else:
        name=name[:200]
        if '(' in name:
          name = name.replace('(', '[')
        if ')' in name:
          name = name.replace(')', ']')
        if ' ' in name:
          name = name.replace(' ', '_')
        if tyepe not in name:
            outtmpl=name+'.mp4'
    
    
      
    if type=='mp4':
        test_opts = {
            'format': 'best[ext=mp4]',
            'outtmpl': outtmpl,
            'noplaylist': True,
        }
    else:
        test_opts = {
            'format': 'best[ext=mp4]',
            'outtmpl': 'baa'+outtmpl,
            'noplaylist': True,
      }
    
    res = YoutubeSearch(url, max_results=1).to_json()
    results = json.loads(res)
    print(results)
    try:
      leVideo = results['videos'][0]
    except Exception as e:
      print(e)
      print('This has been triggered, the link is invalid')
      flash('Invalid Link/Search Query! Please try again.')
      return render_template('index.html')
    else:
      print(leVideo)
      newUrl = 'https://www.youtube.com' + leVideo['url_suffix']
      try:
        duration, ew = leVideo['duration'].split(':')
      except:
        duration=1023012301
      else:
        print(newUrl, duration)
    
    if int(duration) >= 15:
        flash('The Link is over 10 Minutes!')
        return render_template('index.html')
    else:
        with youtube_dl.YoutubeDL(test_opts) as ydl:
            try:
                hunniSEMPAI = ydl.download([newUrl])
            except KeyError:
                print('i dont caaare')
            except Exception as e:
                if "unable to write" in str(e):
                    for filename in os.listdir('/'):
                        if 'temp' in filename or "part" in filename:
                            path = "/home/runner/MusiConvert/"+filename
                            os.remove(path)
                    flash('There seems to be an error with the File System. If this error comes up again, please notify me @shaurya8verma@gmail.com')
                    return render_template('index.html')
                else:
                    flash('This link is invalid or the video isn\'t working right now. Please try again!')
                    return render_template('index.html')
            else:
                if type != 'mp4':
                  filenamee='/home/runner/MusiConvert/'+'baa'+outtmpl
                  
                  outtmpl=outtmpl.replace(' ', '_')
                  if type != 'webm':
                    cmd='ffmpeg -i '+filenamee+' -vn -ab 128k -ar 44100 -y '+name+tyepe
                  else:
                    cmd = 'ffmpeg -i '+filenamee+" "+name+tyepe
                  proc = await asyncio.create_subprocess_shell(cmd,           stdout=asyncio.subprocess.PIPE, stderr=asyncio.subprocess.PIPE)
                  stdout, stderr = await proc.communicate()
                  print(f'[{cmd!r} exited with {proc.returncode}]')
                  if stdout:
                      print(f'[stdout]\n{stdout.decode()}')
                  if stderr:
                      print(f'[stderr]\n{stderr.decode()}')
                  return name+tyepe, os.remove(filenamee)
                else:
                  return name+tyepe


@app.route('/', methods=['POST', 'GET'])
def index():
    if request.method == 'POST':
        print(request.form)
    elif request.method == 'GET':
        return render_template('index.html')
      
@app.route('/yt/<username>', methods=['GET'])
def yt(username):
    linky = username
    print(linky)
    
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(run(linky, 'mp3','', True, True))
    if 'html' not in result:
      print(os.getcwd())
      print(result)
      path = "/home/runner/MusiConvert/"+result[0]
      try:
          return send_file(path, as_attachment=True), os.remove(path)
      except Exception as e:
          print(e)
          flash('The Link/Search Query is Invalid! Please try again.')
          return render_template('index.html')
      else:
          flash('Your Link/Search is invalid or over 10 minutes! Please try again!')
          return render_template('index.html')   
        
@app.route('/mp3/https:/www.youtube.com/watch', methods=['GET'])
def mp3():
    linky = request.args.get('v')
    print(linky)
    
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(run(linky, 'mp3','', True, True))
    if 'html' not in result:
      print(os.getcwd())
      print(result)
      path = "/home/runner/MusiConvert/"+result[0]
      try:
          return send_file(path, as_attachment=True), os.remove(path)
      except Exception as e:
          print(e)
          flash('The Link/Search Query is Invalid! Please try again.')
          return render_template('index.html')
      else:
          flash('Your Link/Search is invalid or over 10 minutes! Please try again!')
          return render_template('index.html')   
        
@app.route('/mp4/https:/www.youtube.com/watch', methods=['GET'])
def mp4():
    linky = request.args.get('v')
    print(linky)
    
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    result = loop.run_until_complete(run(linky, 'mp4','', True, True))
    if 'html' not in result:
      print(os.getcwd())
      print(result)
      path = "/home/runner/MusiConvert/"+result
      try:
          return send_file(path, as_attachment=True), os.remove(path)
      except Exception as e:
          print(e)
          flash('The Link/Search Query is Invalid! Please try again.')
          return render_template('index.html')
      else:
          flash('Your Link/Search is invalid or over 10 minutes! Please try again!')
          return render_template('index.html')   
        
@app.route('/convert', methods=['POST', 'GET'])
def mpconvert():
    print(request.form)
    print('HISIES OMG')

    bananas=0
    print(f"Inside flask function: {threading.current_thread().name}")
    print(bananas)
    asyncio.set_event_loop(asyncio.new_event_loop())
    loop = asyncio.get_event_loop()
    try:
        print(request.form['destroying'])
    except:
        print('This means that the checkbox isnt checked. Time for the reg result.')
        try:
          print(request.form['speedy'])
        except:
          try:
            print(request.form['sameName'])
          except:
            result = loop.run_until_complete(run(request.form['ytLink'], request.form['fileOption'], request.form['name']))
          else:
            result = loop.run_until_complete(run(request.form['ytLink'], request.form['fileOption'], request.form['name'], False, True))
        else:
          try:
            print(request.form['sameName'])
          except:
            result = loop.run_until_complete(run(request.form['ytLink'], request.form['fileOption'], request.form['name'], True))
          else:
            result = loop.run_until_complete(run(request.form['ytLink'], request.form['fileOption'], request.form['name'], True, True))
          if request.form['fileOption'] in ['flac', 'mp3', 'wav', 'aac']:
            result=result[0]
    else:
        if 'mp4' not in request.form['fileOption']:
            try:
              print(request.form['sameName'])
            except:
              result = loop.run_until_complete(modify(request.form['ytLink'], request.files['filename'], request.form['name'], request.form['fileOption'], request.form['modify'], False))
            else:
              result = loop.run_until_complete(modify(request.form['ytLink'], request.files['filename'], request.form['name'], request.form['fileOption'], request.form['modify'], True, True))    
            result=result[0]
            
        else:
            bananas=1

    if bananas==1:
        flash('MP4s cannot be used with File Modification.')
        return render_template('index.html')
    else:
        if 'html' not in result:
            print(os.getcwd())
            print(result)
            if isinstance(result, tuple):
              result = result[0]
            path = "/home/runner/MusiConvert/"+result
            try:
                return send_file(path, as_attachment=True), os.remove(path)
            except Exception as e:
                print(e)
                flash('The Link/Search Query is Invalid! Please try again.')
                return render_template('index.html')
        else:
            flash('Your Link/Search is invalid or over 10 minutes! Please try again!')
            return render_template('index.html')

app.run("0.0.0.0", debug=True)