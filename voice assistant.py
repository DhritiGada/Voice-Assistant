import pyttsx3
import datetime
import speech_recognition as sr
import wikipedia
import webbrowser


engine = pyttsx3.init()


# voices = engine.getProperty('voices')
# engine.setProperty('voice', voices[13].id)

def speak(text):
    print(f'[JARVIS]: {text}')
    engine.say(text)
    engine.runAndWait()


def wish_me():
    hour = int(datetime.datetime.now().hour)
    greeting = ''

    if hour >= 0 and hour < 12:
        greeting = 'Good morning!'
    elif hour >= 12 and hour < 18:
        greeting = 'Good afternoon!'
    else:
        greeting = 'Good evening!'

    speak(f'{greeting} I am Jarvis. How may I help you today?')


def takeCommand():
    # It takes microphone input from the user and returns string output
    r = sr.Recognizer()
    with sr.Microphone() as source:
        print("Listening...")
        r.pause_threshold = 1
        audio = r.listen(source)

    try:
        print("Recognizing...")
        query = r.recognize_google(audio, language='en-in')
        print(f"[Me]: {query}")

    except Exception as e:
        # print(e)
        return "None"
    return query


# script starts here

wish_me()
while True:
    # if 1:
    query = takeCommand().lower()

    # Logic for executing tasks based on query
    query = query.replace('jarvis', '')

    if 'wikipedia' in query:
        speak('Searching Wikipedia...')
        query = query.replace("wikipedia", "")
        query = query.replace("search", "")
        query = query.replace("for", "")
        results = wikipedia.summary(query, sentences=1)
        speak(f'According to Wikipedia, {results}')

    elif 'open youtube' in query:
        speak('Opening Youtube')
        webbrowser.open("https://youtube.com")

    elif 'open google' in query:
        speak('Opening Google')
        webbrowser.open("https://google.com")

    elif 'open stack overflow' in query:
        speak('Opening StackOverflow')
        webbrowser.open("https://stackoverflow.com")

    elif 'what' in query and 'time' in query:
        strTime = datetime.datetime.now().strftime("%H:%M:%S")
        speak(f"Sir, The time is {strTime}")

    elif 'meaning of life' in query:
        speak('Sir, the meaning of life is 42.')

    elif 'how are you' in query:
        speak('I am doing jolly good, sir.')

    else:
        speak('I didn\'t quiet catch you sir. Can you please try that again?')