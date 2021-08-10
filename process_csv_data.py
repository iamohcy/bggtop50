import json
from csv import reader

def makeDict(item):
    return {
        "date": item[0],
        "rank": item[1],
        "name": item[2],
        "bgg_id": item[3],
        "bgg_link": item[4],
    }


filtered_item_list = None
# read csv file as a list of lists
with open('all_data.csv', 'r') as read_obj:
    # pass the file object to reader() to get the reader object
    csv_reader = reader(read_obj)
    # Pass reader object to list() to get a list of lists
    item_list = list(csv_reader)
    filtered_item_list = [makeDict(item) for item in item_list if int(item[1]) <= 50]

    final_dict = {}
    for item in filtered_item_list:
      if item["name"] not in final_dict:
        final_dict[item["name"]] = []

      final_dict[item["name"]].append(item)

with open('data.js', 'w') as f:
    json.dump(final_dict, f)
