from bs4 import BeautifulSoup
import requests
import csv
import re


def getMonthFromTitle(str):
    print(str)
    match = re.search("to ([0-9]+ [a-zA-Z]+ [0-9]+)", str)
    dateStr = match.group(1)
    return dateStr

page = requests.get("https://www.boardgamegeek.com/geeklist/30543/bgg-top-50-statistics-meta-list?titlesonly=1")
soup = BeautifulSoup(page.content, 'html.parser')

links = soup.find_all('a')
bgg_links = [["https://www.boardgamegeek.com" + link.get('href'), getMonthFromTitle(str(link.decode_contents()))] for link in links if ("BGG Top 50" in str(link)) and ("Overview" not in str(link))]


f = open('month_links.csv', 'w', newline='')

with f:
    writer = csv.writer(f)
    for link in bgg_links:
        writer.writerow(link)

# def getDataFromBoardGameLink(str):
    # bgg_links = [link for link in links if ("BGG Top 50" in str(link)) and ("Overview" not in str(link))]


f = open('all_data.csv', 'w', newline='')
allLinks = []
with f:
    writer = csv.writer(f)

    for (href, dateStr) in bgg_links:
        print ("Processing Top 50 for: " + dateStr)
        page = requests.get(href+"?titlesonly=1")
        soup = BeautifulSoup(page.content, 'html.parser')

        link_divs = soup.find_all("div", {"class": "mb5"})
        bgg_links = [link_div.find_all('a')[1] for link_div in link_divs]

        filtered_links = [link for link in bgg_links if "/boardgame/" in str(link)]
        processed_links = [[dateStr, id+1, str(link.decode_contents()), re.search("boardgame/([0-9]+)/",link.get('href')).group(1), link.get('href')] for (id, link) in enumerate(filtered_links)]

        for link in processed_links:
            writer.writerow(link)
            allLinks.append(link)

