import os
import requests
from flask import Flask, request, send_from_directory
from dotenv import load_dotenv
import genanki
import csv
import random

load_dotenv()

app = Flask(__name__)

url = os.environ.get("DB_URL")
api_key = os.environ.get("API_KEY")
api_id = os.environ.get("API_ID")
uploads_path = os.environ.get("UPLOADS_PATH")
dict_api_url = "https://od-api.oxforddictionaries.com:443/api/v2/entries/"

@app.post("/api/create_deck")
def create_deck():
    data = request.get_json()
    endpoint = data["link"]
    file_id = data["file_id"]

    model_id = random.randrange(1 << 30, 1 << 31)
    deck_id = random.randrange(1 << 30, 1 << 31)

    my_model = genanki.Model(
    model_id,
    'Vocab Card Model',
    fields=[
        {'name': 'Word'},
        {'name': 'Definition'},
    ],
    templates=[
        {
        'name': 'Card 1',
        'qfmt': '{{Word}}',
        'afmt': '{{FrontSide}}<hr id="answer">{{Definition}}',
        },
    ])

    my_deck = genanki.Deck(
    deck_id,
    'Vocab Cards')

    if not os.path.exists(uploads_path):
        os.mkdir(uploads_path)

    with requests.get(endpoint, stream=True) as r:

        if (r.ok):
            if r.encoding is None:
                r.encoding = 'utf-8'

            line_length = None
            total_cards = 0

            for line in r.iter_lines(chunk_size=1, decode_unicode=True):
                # if line is not empty
                if line:
                    if not bool(line_length):
                        line_length = len(line.split(","))
                    if line_length == len(line.split(",")):
                        word, definition = line.split(",")
                        new_note = genanki.Note(model=my_model, fields=[word, definition])

                        my_deck.add_note(new_note)
                        genanki.Package(my_deck).write_to_file(f"{uploads_path}/anki_deck_{file_id}.apkg")
                        
                        total_cards += 1
            print(f"added a total of {total_cards} cards to deck")
            # The deck must be emptied upon completing the FOR loop
        
        return {
            "status": "success",
            "link": f"http://127.0.0.1:5000/uploads/anki_deck_{file_id}.apkg"
            }
        
    # vocab_list = data["vocab_list"]
    # lang_code = data["lang"]
    # headers = {"app_id": api_id, "app_key": api_key}

    # words = []

    # for i in vocab_list:
    #     endpoint = api_url + lang_code + "/" + i.lower()
    #     # r = requests.get(endpoint, headers=headers)
    #     # response_json = r.json()
    #     # definition = response_json["results"][0]["lexicalEntries"][0]["entries"][0]["senses"][0]["shortDefinitions"][0]
    #     # words.append({"word": i, "definition": definition})
    #     # print(f"pushed {i} and it's definition to the list")
    #     words.append({"word": "blow up", "definition": "to explode"})
    #     new_note = createNote(["blow up", "to explode"])
    #     my_deck.add_note(new_note)

    #     genanki.Package(my_deck).write_to_file('output.apkg')
    # return words
    

@app.get("/uploads/<path:filename>")
def download(filename):
    uploads = os.path.join(app.root_path, 'anki_decks')
    print(uploads)
    return send_from_directory(uploads, filename)